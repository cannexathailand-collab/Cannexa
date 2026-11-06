import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dashboardData,dashboardRange} from '../src/lib/accounting-dashboard';
import {summarizeAccounting} from '../src/lib/accounting-summary';
test('dashboard periods resolve full days, leap months and years independently of the page range',()=>{
 const base={from:'2026-11-01',to:'2026-11-07'};
 assert.deepEqual(dashboardRange('range','2024-02-10',base),base);
 assert.deepEqual(dashboardRange('day','2024-02-10',base),{from:'2024-02-10',to:'2024-02-10'});
 assert.deepEqual(dashboardRange('month','2024-02-10',base),{from:'2024-02-01',to:'2024-02-29'});
 assert.deepEqual(dashboardRange('year','2024-02-10',base),{from:'2024-01-01',to:'2024-12-31'});
 assert.throws(()=>dashboardRange('month','2024-13-10',base));
});
test('dashboard uses the accounting totals, preserves losses and separates expense credits',()=>{
 const report=summarizeAccounting({from:'2026-11-07',to:'2026-11-07'},[{day:'2026-11-07',count:1,revenueSatang:10000,transferSatang:10000,codSatang:0}],[{id:'one',kind:'LINE',amountSatang:15000,date:new Date('2026-11-07T10:00:00+07:00'),description:'expense',recipient:null,bankName:null,bankAccount:null},{id:'credit',kind:'LINE',amountSatang:-1000,date:new Date('2026-11-07T10:00:00+07:00'),description:'credit',recipient:null,bankName:null,bankAccount:null}]);
 const data=dashboardData({...report,sources:[{name:'ลูกค้าเก่า',revenueSatang:10000}],notices:['pending']});
 assert.equal(data.total.profitSatang,-4000);assert.equal(data.rows[0].profitSatang,-4000);assert.equal(data.expenses.grossSatang,15000);assert.equal(data.expenses.creditsSatang,1000);assert.equal(data.expenses.netSatang,14000);assert.equal(data.sources[0].amountSatang,10000);assert.equal(data.pending,true);
});
