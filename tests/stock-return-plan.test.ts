import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stockRows} from '../src/lib/stock-import';
import {STOCK_COMPLETED_HEADER,verifyFlowPlan} from '../src/lib/stock-flow-plan';
import {STOCK_PRECOUNTED_HEADER,STOCK_UNVERIFIED_HEADER} from '../src/lib/stock-available';
import {stockReturnItems,stockReturnPlan,returnedItemsAtPlan} from '../src/lib/stock-return-plan';

const item={code:'CG2',name:'Original name',quantityMilliG:500000,unitCostSatang:150,costSatang:75000,issuedBefore:500,issuedAfter:0,remainingBefore:446,remainingAfter:-54};
function source(credit=0,unknown=0){
 const rows:unknown[][]=[['','','รายการ','','จำนวนรับ','จำนวนรอจ่าย','จำนวนคงเหลือ','','','','','',STOCK_COMPLETED_HEADER,'ขายได้',STOCK_PRECOUNTED_HEADER,STOCK_UNVERIFIED_HEADER],[],['','New name','CG2',99,-54+credit,100,-54,'','','','','',credit,unknown?'':-154+credit,credit,unknown]];
 return {tab:{sheetId:5,title:'6.11.69'},rows,products:stockRows(rows,{costColumnConfirmed:true})};
}
test('return restores original quantity to a negative balance and preserves pending demand, current cost and name',()=>{
 const current=source(),before=structuredClone(current),plan=stockReturnPlan([item],current),change=plan.changes[0];
 assert.equal(change.received,446);assert.equal(change.remainingAfter,446);assert.equal(change.pendingAfter,100);assert.equal(change.completedAfter,0);
 assert.deepEqual(plan.requests.map(r=>r.updateCells.start.columnIndex),[4,6]);assert.deepEqual(current,before);
 const history=returnedItemsAtPlan([item],plan)[0];assert.equal(history.unitCostSatang,150);assert.equal(history.costSatang,75000);assert.equal(history.name,'Original name');
 assert.equal(history.remainingBefore,-54);assert.equal(history.remainingAfter,446);
 const after=source();after.rows[2][4]=446;after.rows[2][6]=446;after.rows[2][13]=346;after.products=stockRows(after.rows,{costColumnConfirmed:true});
 assert.equal(verifyFlowPlan(plan,after),true);
});
test('return retains historical credits and unresolved quantities without inventing availability',()=>{
 const current=source(20,30),plan=stockReturnPlan([item],current),change=plan.changes[0];
 assert.equal(change.received,466);assert.equal(change.remainingAfter,446);assert.equal(change.pendingAfter,100);assert.equal(change.completedAfter,20);assert.equal(change.precountedAfter,20);assert.equal(change.unverifiedAfter,30);
 current.rows[2][4]=466;current.rows[2][6]=446;current.products=stockRows(current.rows,{costColumnConfirmed:true});
 assert.equal(verifyFlowPlan(plan,current),true);
});
test('original item costs are frozen, zero cost is valid, and malformed or duplicate dispatch items are rejected',()=>{
 assert.deepEqual(stockReturnItems([item],75000),[item]);assert.equal(stockReturnItems([{...item,unitCostSatang:0,costSatang:0}],0)[0].costSatang,0);
 assert.throws(()=>stockReturnItems([item],1),/COST_MISMATCH/);
 for(const invalid of [[],[item,{...item,code:' ｃｇ２ '}],[{...item,quantityMilliG:0}],[{...item,quantityMilliG:1.5}],[{...item,costSatang:-1}],[{...item,unitCostSatang:null}]])assert.throws(()=>stockReturnItems(invalid,75000),/ITEMS_INVALID/);
});
test('return plan refuses missing, unknown, inconsistent or duplicate quantities before producing writes',()=>{
 assert.throws(()=>stockReturnPlan([{...item,code:'MISSING'}],source()),/PRODUCT_NOT_FOUND/);
 const unknown=source();unknown.products[0].receivedQuantity=null;unknown.products[0].remainingQuantity=null;
 assert.throws(()=>stockReturnPlan([item],unknown),/QUANTITY_UNKNOWN/);
 const mismatch=source();mismatch.products[0].remainingQuantity=0;assert.throws(()=>stockReturnPlan([item],mismatch),/BALANCE_MISMATCH/);
 assert.throws(()=>stockReturnPlan([item,{...item,code:'cg2'}],source()),/ITEMS_INVALID/);
 assert.throws(()=>stockReturnPlan([{...item,quantityMilliG:-1}],source()),/ITEMS_INVALID/);
});
