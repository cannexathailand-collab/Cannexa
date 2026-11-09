import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyWorkbookRequests,readWorkbook,workbookValues,type StockWorkbookState} from '../src/lib/stock-workbook-state';
import {stockReadOnlyProtectionRequests} from '../src/lib/stock-workbook-sync';
import {STOCK_COMPLETED_HEADER,flowReservationPlan,flowDispatchPlan} from '../src/lib/stock-flow-plan';
import {stockRows} from '../src/lib/stock-import';
import {stockReceiptPlan} from '../src/lib/stock-receipt';

function fixture():StockWorkbookState{
 const state:StockWorkbookState={activeSheetId:1,sheets:[{properties:{sheetId:1,title:'9.11.69',gridProperties:{rowCount:1000,columnCount:26}},rows:[[null,null,'รายการ',null,'จำนวนรับ','จำนวนรอจ่าย','จำนวนคงเหลือ',null,null,null,null,null,STOCK_COMPLETED_HEADER],[null,null,null,null,null,null,null,null,'10G','50G','100G','1000G'],[null,'Item','A1',2,100,10,'=INDEX(E:E,ROW())-INDEX(M:M,ROW())',null,50,100,200,1000,0,'=IF(OR(INDEX(G:G,ROW())="",N(INDEX(P:P,ROW()))>0),"",INDEX(G:G,ROW())-INDEX(F:F,ROW())+N(INDEX(O:O,ROW())))',0,0]]}],metadata:[],pending:[]};
 return state;
}
const source=(state:StockWorkbookState)=>({tab:state.sheets[0].properties,rows:workbookValues(state.sheets[0]),products:stockRows(workbookValues(state.sheets[0]),{costColumnConfirmed:true})});

test('system workbook runs receipt, reserve and dispatch plans with formulas and durable markers',()=>{
 let state=fixture();
 const receipt=stockReceiptPlan({requestKey:'receipt',code:'A1',name:'Item',cost:2,quantity:25,prices:[]},source(state),'=INDEX(E:E,ROW())-INDEX(M:M,ROW())');
 state=applyWorkbookRequests(state,receipt.requests);
 assert.equal(source(state).products[0].remainingQuantity,125);
 assert.equal((readWorkbook(state,'/developerMetadata:search',{dataFilters:[{developerMetadataLookup:{metadataKey:'cannexa-stock-receipt-receipt'}}]}) as any).matchedDeveloperMetadata.length,1);
 const items=[{code:'A1',quantityMilliG:20000}];
 state=applyWorkbookRequests(state,flowReservationPlan(items,source(state)).requests);
 assert.equal(source(state).products[0].issuedQuantity,30);
 state=applyWorkbookRequests(state,flowDispatchPlan(items,source(state)).requests);
 assert.equal(source(state).products[0].remainingQuantity,105);
 assert.equal(source(state).products[0].issuedQuantity,10);
 assert.equal(state.pending.length,3);
 assert.equal(fixture().sheets[0].rows[2][4],100);
});

test('system workbook supports new products, sorting, history tabs and row deletion',()=>{
 let state=fixture();
 const receipt=stockReceiptPlan({requestKey:'new',code:'A0',name:'New',cost:3,quantity:10,prices:[]},source(state));
 state=applyWorkbookRequests(state,receipt.requests);
 assert.deepEqual(source(state).products.map(p=>p.code),['A0','A1']);
 state=applyWorkbookRequests(state,[{addSheet:{properties:{sheetId:2,title:'Archive',gridProperties:{columnCount:10,rowCount:100}}}},{appendCells:{sheetId:2,rows:[{values:[{userEnteredValue:{stringValue:'saved'}}]}]}}]);
 assert.deepEqual((readWorkbook(state,'/values/Archive!A1:J10') as any).values,[['saved']]);
 state=applyWorkbookRequests(state,[{deleteDimension:{range:{sheetId:1,dimension:'ROWS',startIndex:2,endIndex:3}}}]);
 assert.deepEqual(source(state).products.map(p=>p.code),['A1']);
});

test('managed sheet protection restricts editing to the service account',()=>{
 const requests=stockReadOnlyProtectionRequests([{properties:{sheetId:1}},{properties:{sheetId:2},protectedRanges:[{protectedRangeId:5,description:'Cannexa: managed by system'}]}],[1,2],'service@example.com');
 assert.equal(requests[0].addProtectedRange?.protectedRange.warningOnly,false);
 assert.deepEqual(requests[0].addProtectedRange?.protectedRange.editors.users,['service@example.com']);
 assert.equal(requests[1].updateProtectedRange?.protectedRange.protectedRangeId,5);
});

test('existing whole-sheet warning protection is upgraded without adding a duplicate',()=>{
 const requests=stockReadOnlyProtectionRequests([{properties:{sheetId:3},protectedRanges:[{protectedRangeId:9,description:'Old archive',warningOnly:true,range:{sheetId:3}}]}],[3],'service@example.com');
 assert.equal(requests.length,1);assert.equal(requests[0].updateProtectedRange?.protectedRange.protectedRangeId,9);
 assert.equal(requests[0].updateProtectedRange?.protectedRange.warningOnly,false);
});
