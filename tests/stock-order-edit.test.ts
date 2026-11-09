import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stockRows} from '../src/lib/stock-import';
import {flowReplaceReservationPlan,STOCK_COMPLETED_HEADER} from '../src/lib/stock-flow-plan';
import {STOCK_PRECOUNTED_HEADER,STOCK_UNVERIFIED_HEADER} from '../src/lib/stock-available';
const source=(precounted=false)=>{
 const rows:any[][]=[[],[],['','A','A1',1,100,10,precounted?90:100,'','','','','',precounted?10:0,'',precounted?10:0,0],['','B','B1',1,100,0,100,'','','','','',0,'',0,0]];
 rows[0][12]=STOCK_COMPLETED_HEADER;rows[0][14]=STOCK_PRECOUNTED_HEADER;rows[0][15]=STOCK_UNVERIFIED_HEADER;
 return {tab:{title:'stock',sheetId:1},rows,products:stockRows(rows)};
};
test('changing reserved products releases the old quantities and reserves the new quantities',()=>{
 const plan=flowReplaceReservationPlan([{code:'A1',quantityMilliG:10000}],[{code:'B1',quantityMilliG:5000}],source());
 assert.equal(plan.changes.find(c=>c.code==='A1')?.pendingAfter,0);
 assert.equal(plan.changes.find(c=>c.code==='B1')?.pendingAfter,5);
 assert.ok(plan.changes.every(c=>c.remainingAfter===100));
});
test('editing a precounted reservation restores its old physical deduction before reserving anew',()=>{
 const plan=flowReplaceReservationPlan([{code:'A1',quantityMilliG:10000}],[{code:'A1',quantityMilliG:5000}],source(true),true);
 assert.equal(plan.changes.length,1);
 assert.equal(plan.changes[0].pendingBefore,10);assert.equal(plan.changes[0].pendingAfter,5);
 assert.equal(plan.changes[0].remainingAfter,100);assert.equal(plan.changes[0].completedAfter,0);assert.equal(plan.changes[0].precountedAfter,0);
});
