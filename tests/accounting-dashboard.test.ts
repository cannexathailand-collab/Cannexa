import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dashboardData,dashboardQuery} from '../src/lib/accounting-dashboard';
import {summarizeAccounting} from '../src/lib/accounting-summary';
test('changing chart grouping preserves arbitrary date boundaries including a partial month',()=>{
 for(const view of ['day','month','year'] as const){
  const query=new URLSearchParams(dashboardQuery({from:'2026-10-29',to:'2026-11-04',view}));
  assert.equal(query.get('from'),'2026-10-29');assert.equal(query.get('to'),'2026-11-04');assert.equal(query.get('view'),view);
 }
 assert.ok(dashboardQuery({from:'2024-02-29',to:'2024-03-01',view:'day'}));
 assert.throws(()=>dashboardQuery({from:'2026-02-29',to:'2026-03-01',view:'day'}));
 assert.throws(()=>dashboardQuery({from:'2026-11-07',to:'2026-11-01',view:'day'}));
});
test('dashboard uses the accounting totals, preserves losses and separates expense credits',()=>{
 const report=summarizeAccounting({from:'2026-11-07',to:'2026-11-07'},[{day:'2026-11-07',count:1,revenueSatang:10000,transferSatang:10000,codSatang:0}],[{id:'one',kind:'LINE',amountSatang:15000,date:new Date('2026-11-07T10:00:00+07:00'),description:'expense',recipient:null,bankName:null,bankAccount:null},{id:'credit',kind:'LINE',amountSatang:-1000,date:new Date('2026-11-07T10:00:00+07:00'),description:'credit',recipient:null,bankName:null,bankAccount:null}]);
 const data=dashboardData({...report,sources:[{name:'ลูกค้าเก่า',revenueSatang:10000}],notices:['pending']});
 assert.equal(data.total.profitSatang,-4000);assert.equal(data.rows[0].profitSatang,-4000);assert.equal(data.expenses.grossSatang,15000);assert.equal(data.expenses.creditsSatang,1000);assert.equal(data.expenses.netSatang,14000);assert.equal(data.sources[0].amountSatang,10000);assert.equal(data.pending,true);
});
