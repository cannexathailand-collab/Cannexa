import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountingRange,accountingMonthRange,summarizeAccounting,accountingCsv} from '../src/lib/accounting-summary';
import type {ExpenseEntry} from '../src/lib/expense-report';
const expense=(id:string,kind:ExpenseEntry['kind'],amountSatang:number,date='2026-11-06T12:00:00+07:00',description='รายการ'):ExpenseEntry=>({id,kind,amountSatang,date:new Date(date),description,recipient:null,bankName:null,bankAccount:null});
const sale={day:'2026-11-06',count:1,revenueSatang:100000,transferSatang:100000,codSatang:0};

test('year view groups Bangkok days without changing net totals or CSV period',()=>{
 const range={from:'2026-12-31',to:'2027-01-02'},sales=[{...sale,day:'2026-12-31'},{...sale,day:'2027-01-01'}],expenses=[expense('dec','LINE',300,'2026-12-31T16:59:59Z'),expense('jan','LINE',500,'2026-12-31T17:00:00Z')];
 const daily=summarizeAccounting(range,sales,expenses),year=summarizeAccounting(range,sales,expenses,'year');
 assert.deepEqual(year.total,daily.total);assert.deepEqual(year.rows.map(r=>[r.day,r.profitSatang]),[['2026',99700],['2027',99500]]);assert.ok(accountingCsv(year).includes('รายปี'));
});
test('profit deducts all expense categories once, including product costs and paid commissions',()=>{
 const r=summarizeAccounting({from:'2026-11-06',to:'2026-11-06'},[sale],[expense('stock','PRODUCT_COST',30000),expense('line','LINE',10000),expense('rec','RECURRING',5000),expense('freight','FREIGHT',4000),expense('friend','FRIEND',1000),expense('commission','SALE',2000)]);
 assert.equal(r.total.expenseSatang,52000);assert.equal(r.total.profitSatang,48000);assert.equal(r.total.commissionSatang,3000);assert.equal(r.total.productCostSatang,30000);
});
test('daily and monthly totals reconcile across months, with empty days and Bangkok midnight',()=>{
 const range={from:'2026-10-31',to:'2026-11-07'},expenses=[expense('oct','LINE',300,'2026-10-31T16:59:59Z'),expense('nov','LINE',500,'2026-10-31T17:00:00Z')];
 const d=summarizeAccounting(range,[sale],expenses),m=summarizeAccounting(range,[sale],expenses,'month');
 assert.deepEqual(d.total,m.total);assert.equal(m.rows.length,2);assert.equal(m.rows[0].expenseSatang,300);assert.equal(m.rows[1].expenseSatang,500);assert.equal(d.rows.at(-1)?.profitSatang,0);assert.equal(m.rows.reduce((n,r)=>n+r.profitSatang,0),99200);
});
test('return credits reduce costs, losses remain negative and repeated expense identity is counted once',()=>{
 const e=expense('cost','PRODUCT_COST',60000),credit=expense('return','PRODUCT_COST',-10000);
 const r=summarizeAccounting({from:'2026-11-06',to:'2026-11-06'},[],[e,e,credit]);
 assert.equal(r.total.productCostSatang,50000);assert.equal(r.total.profitSatang,-50000);assert.equal(r.entries.length,2);
 assert.throws(()=>summarizeAccounting(r.range,[],[e,{...e,amountSatang:1}]),/CONFLICT/);
});
test('filters exclude out of range data and month drill-down retains partial date bounds',()=>{
 const range={from:'2026-10-15',to:'2026-11-06'};
 assert.deepEqual(accountingMonthRange('2026-10',range),{from:'2026-10-15',to:'2026-10-31',view:'day'});
 assert.deepEqual(accountingMonthRange('2026-11',range),{from:'2026-11-01',to:'2026-11-06',view:'day'});
 const r=summarizeAccounting({from:'2026-11-07',to:'2026-11-07'},[sale],[expense('outside','LINE',100)]);assert.equal(r.total.expenseSatang,0);assert.equal(r.total.revenueSatang,0);
});
test('date validation rejects invalid, backwards and oversized ranges and allows a leap year',()=>{
 for(const range of [{from:'2026-02-30',to:'2026-03-01'},{from:'2026-11-07',to:'2026-11-06'},{from:'2025-01-01',to:'2026-12-31'}])assert.throws(()=>accountingRange(range));
 assert.deepEqual(accountingRange({from:'2024-01-01',to:'2024-12-31'}),{from:'2024-01-01',to:'2024-12-31'});
});
test('CSV exports the displayed totals, Thai BOM, pending notes, signed numbers and safe detail cells',()=>{
 const r=summarizeAccounting({from:'2026-11-06',to:'2026-11-06'},[],[expense('return','PRODUCT_COST',-12345,undefined,'=HYPERLINK("bad")')]);
 const csv=accountingCsv(r,['ต้นทุนยังไม่ครบ']);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('ต้นทุนยังไม่ครบ'));assert.ok(csv.includes('-123.45'));assert.ok(csv.includes('123.45'));assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('รวม'));assert.equal(r.total.profitSatang,12345);
});
test('freight detail and CSV consolidate once per Bangkok day, even in monthly view',()=>{
 const first=expense('one','FREIGHT',3500,'2026-11-05T17:00:00Z');
 const entries=[first,first,expense('two','FREIGHT',4500,'2026-11-06T16:59:59Z'),expense('three','FREIGHT',6000,'2026-11-06T17:00:00Z'),expense('line','LINE',2000)];
 for(const view of ['day','month']){
  const r=summarizeAccounting({from:'2026-11-06',to:'2026-11-07'},[],entries,view);
  const freight=r.entries.filter(e=>e.kind==='FREIGHT');assert.equal(freight.length,2);
  assert.equal(freight.find(e=>e.id==='freight-day:2026-11-06')?.amountSatang,8000);
  assert.equal(freight.find(e=>e.id==='freight-day:2026-11-07')?.amountSatang,6000);
  assert.ok(freight.find(e=>e.id==='freight-day:2026-11-06')?.description.includes('2 พัสดุ'));
  assert.equal(r.entries.filter(e=>e.kind==='LINE').length,1);
  assert.equal(r.total.freightSatang,14000);assert.equal(r.total.expenseSatang,16000);assert.equal(r.total.profitSatang,-16000);
  assert.equal(r.entries.reduce((n,e)=>n+e.amountSatang,0),r.total.expenseSatang);
  const csv=accountingCsv(r);assert.equal(csv.split('\r\n').filter(line=>line.includes('freight-day:')).length,2);
 }
});
