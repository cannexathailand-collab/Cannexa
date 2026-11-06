import {test} from 'node:test';import assert from 'node:assert/strict';import {stockReceiptPlan,recoverReceipt} from '../src/lib/stock-receipt';import {newStockProduct} from '../src/lib/stock-product-input';import {stockRows} from '../src/lib/stock-import';
const base={requestKey:'ad83d6b7-84b5-4b42-b45f-fdf7285c80cf',code:'NT16',quantity:10,prices:[]};
const rows=[[],[],[null,'Original','NT16',18,2086,251,1835]];
const source={tab:{sheetId:5,title:'5.11.69',gridProperties:{columnCount:26}},rows,products:stockRows(rows,{costColumnConfirmed:true})};
test('existing code adds received and remaining only while preserving issued and product details',()=>{const plan=stockReceiptPlan(newStockProduct.parse({...base,name:'ignored',cost:99}),source);assert.equal(plan.result.mode,'RECEIVED');assert.equal(plan.result.receivedAfter,2096);assert.equal(plan.result.remainingAfter,1845);const updates=plan.requests.filter((r:any)=>r.updateCells) as any[];assert.deepEqual(updates.map(r=>r.updateCells.start.columnIndex),[4,6]);assert.ok(!plan.requests.some((r:any)=>r.appendCells));assert.ok(!plan.requests.some((r:any)=>r.sortRange));});
test('existing remaining formula is retained instead of being replaced with a literal',()=>{const plan=stockReceiptPlan(newStockProduct.parse(base),source,'=E3-F3');assert.equal(plan.requests.filter((r:any)=>r.updateCells).length,1);});
test('a missing existing name can be filled without overwriting an existing name or adding stock',()=>{const unnamed={...source,products:source.products.map(p=>({...p,name:null}))};const plan=stockReceiptPlan(newStockProduct.parse({...base,name:'New name',quantity:0}),unnamed);const nameWrite=(plan.requests as any[]).find(r=>r.updateCells?.start.columnIndex===1);assert.equal(nameWrite.updateCells.rows[0].values[0].userEnteredValue.stringValue,'New name');assert.equal(plan.result.receivedAfter,2086);assert.equal(plan.result.remainingAfter,1835);assert.equal(plan.result.nameAfter,'New name');const named=stockReceiptPlan(newStockProduct.parse({...base,name:'Replacement'}),source);assert.ok(!(named.requests as any[]).some(r=>r.updateCells?.start.columnIndex===1));assert.equal(named.result.nameAfter,'Original');});
test('new code creates a row, sorts whole rows by code and records retry metadata atomically',()=>{const input=newStockProduct.parse({...base,code:'BOX-A',name:'Box',cost:2});const plan=stockReceiptPlan(input,source);assert.equal(plan.result.mode,'CREATED');assert.ok(plan.requests[0].appendCells);const sort=(plan.requests.find((r:any)=>r.sortRange) as any).sortRange;assert.equal(sort.sortSpecs[0].dimensionIndex,26);assert.equal(sort.range.endColumnIndex,27);assert.equal(sort.range.endRowIndex,4);const cleanup=plan.requests.findIndex((r:any)=>r.deleteDimension),marker=plan.requests.findIndex((r:any)=>r.createDeveloperMetadata);assert.ok(cleanup>plan.requests.findIndex((r:any)=>r.sortRange));assert.ok(marker>cleanup);const metadata=(plan.requests[marker] as any).createDeveloperMetadata.developerMetadata;assert.deepEqual(recoverReceipt(input,{matchedDeveloperMetadata:[{developerMetadata:metadata}]}),plan.result);assert.throws(()=>recoverReceipt({...input,quantity:11},{matchedDeveloperMetadata:[{developerMetadata:metadata}]}),/REQUEST_CHANGED/);});
test('new products need details and unknown old balances are never treated as zero',()=>{assert.throws(()=>stockReceiptPlan(newStockProduct.parse({...base,code:'NEW'}),source),/DETAILS_REQUIRED/);const unknown={...source,products:source.products.map(p=>({...p,remainingQuantity:null}))};assert.throws(()=>stockReceiptPlan(newStockProduct.parse(base),unknown),/QUANTITY_UNKNOWN/);});

test('receiving an existing item ranks numeric codes without touching existing helper columns or receipt recovery',()=>{
 const rows=[[],[],[null,'Thirteen','CG13',2,100,0,100],[null,'Two','CG2',2,50,0,50]];
 const source={tab:{sheetId:5,title:'6.11.69',gridProperties:{columnCount:30}},rows,products:stockRows(rows,{costColumnConfirmed:true})};
 const input=newStockProduct.parse({...base,code:'CG2'}),plan=stockReceiptPlan(input,source);
 const writes=plan.requests.filter((r:any)=>r.updateCells) as any[];
 assert.deepEqual(writes.map(r=>r.updateCells.start.columnIndex),[4,6,30]);
 assert.equal(writes[0].updateCells.start.rowIndex,3);assert.equal(writes[0].updateCells.rows[0].values[0].userEnteredValue.numberValue,60);
 assert.deepEqual(writes[2].updateCells.rows.map((r:any)=>r.values[0].userEnteredValue.numberValue),[2,1]);
 const metadata=(plan.requests.find((r:any)=>r.createDeveloperMetadata) as any).createDeveloperMetadata.developerMetadata;
 const recovered=recoverReceipt(input,{matchedDeveloperMetadata:[{developerMetadata:metadata}]});
 assert.equal(recovered?.receivedBefore,50);assert.equal(recovered?.receivedAfter,60);assert.equal(recovered?.remainingAfter,60);
 assert.equal(plan.requests.at(-1)?.createDeveloperMetadata!==undefined,true);
});


