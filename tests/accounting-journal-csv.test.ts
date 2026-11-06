import assert from 'node:assert/strict';
import {test} from 'node:test';
import {accountingJournalCsv} from '../src/lib/accounting-journal-csv';
test('journal export restarts net every day and keeps exact period totals',()=>{
 const csv=accountingJournalCsv({range:{from:'2026-11-01',to:'2026-11-02'},notices:['pending'],journal:[
  {id:'1',date:new Date('2026-11-01T12:00:00+07:00'),description:'income',incomeSatang:10000,expenseSatang:0,balanceSatang:10000},
  {id:'2',date:new Date('2026-11-01T13:00:00+07:00'),description:'expense',incomeSatang:0,expenseSatang:2000,balanceSatang:8000},
  {id:'3',date:new Date('2026-11-02T12:00:00+07:00'),description:'=bad',incomeSatang:0,expenseSatang:3000,balanceSatang:5000},
 ]});
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('pending'));assert.ok(csv.includes('"2026-11-02","\'=bad",-30.00,0.00,30.00'));assert.ok(csv.includes('50.00,100.00,50.00'));assert.ok(csv.includes('80.00,100.00,20.00'));
});
