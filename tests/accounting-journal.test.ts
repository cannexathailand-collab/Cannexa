import {test} from 'node:test';import assert from 'node:assert/strict';import {accountingJournal} from '../src/lib/accounting-journal';import type {SaleRow} from '../src/lib/sales-report';import type {ExpenseEntry} from '../src/lib/expense-report';
test('journal records one sale, separate commissions, and a return credit with exact running net',()=>{
 const date=new Date('2026-11-07T01:00Z');const sales=[{id:'sale',recognizedAt:date,revenueSatang:100000,paymentMethod:'TRANSFER',order:{orderNumber:'ORDER'}}] as SaleRow[];
 const expenses=[{id:'a',kind:'SALE',date:new Date(+date+1000),description:'ผู้แนะนำ',amountSatang:5000},{id:'b',kind:'SALE',date:new Date(+date+2000),description:'ผู้ปิด',amountSatang:3000},{id:'refund',kind:'PRODUCT_COST',date:new Date(+date+3000),description:'คืนต้นทุน',amountSatang:-1000}] as ExpenseEntry[];
 const rows=accountingJournal(sales,expenses);assert.equal(rows.length,4);assert.equal(rows.reduce((n,r)=>n+r.incomeSatang,0),100000);assert.equal(rows.reduce((n,r)=>n+r.expenseSatang,0),7000);assert.equal(rows.at(-1)?.balanceSatang,93000);assert.deepEqual(rows.map(r=>r.balanceSatang),[100000,95000,92000,93000]);
});
