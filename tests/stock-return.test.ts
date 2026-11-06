import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {db} from '../src/lib/db';
import {encryptGmail} from '../src/lib/gmail';
import {processStockReturn,confirmStockReturnReceived,processPendingStockReturns} from '../src/lib/stock-return';
import {stockReturnExpenses} from '../src/lib/stock-cost-expenses';
import {STOCK_COMPLETED_HEADER} from '../src/lib/stock-flow-plan';
import {STOCK_PRECOUNTED_HEADER,STOCK_UNVERIFIED_HEADER} from '../src/lib/stock-available';
import {stockReturnArchive} from '../src/lib/stock-return-archive';
import {sha} from '../src/lib/crypto';
import {syncStockReservation} from '../src/lib/stock-flow';

const tracking='EF123456789TH';
const originalItem={code:'CG2',name:'Original name',quantityMilliG:500000,unitCostSatang:150,costSatang:75000,issuedBefore:500,issuedAfter:0,remainingBefore:446,remainingAfter:-54};
function replace(t:TestContext,target:any,key:string,value:any){const old=target[key];target[key]=value;t.after(()=>{target[key]=old;});}
function harness(t:TestContext){
 const oldSecret=process.env.SESSION_SECRET;process.env.SESSION_SECRET='return-test';t.after(()=>{if(oldSecret===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=oldSecret;});
 const day=86400000,now=Date.now(),reportedAt=new Date(now-day),dispatchedAt=new Date(now-2*day);
 const rows:any[][]=[['','','รายการ','','จำนวนรับ','จำนวนรอจ่าย','จำนวนคงเหลือ','','','','','',STOCK_COMPLETED_HEADER,'ขายได้',STOCK_PRECOUNTED_HEADER,STOCK_UNVERIFIED_HEADER],[],['','New name','CG2',99,-54,100,-54,'','','','','',0,-154,0,0]];
 const state={
  row:{id:'return1',tracking,orderId:'order1',stage:'RECEIVED',status:'PENDING',reportedAt,receivedAt:null,evidence:[{format:'MYORDER_RETURN_TABLE',stage:'RECEIVED',statusText:'นำส่งคืนผู้ฝากส่งสำเร็จ'}],items:[],sourceSheet:null,totalCostSatang:null,historySnapshot:null,historySavedAt:null,processedAt:null,issues:[],createdAt:reportedAt,updatedAt:reportedAt} as any,
  dispatch:{id:'dispatch1',orderId:'order1',orderNumber:'ORDER1',candidateTracking:tracking,tracking,status:'POSTED',items:[structuredClone(originalItem)],totalCostSatang:75000,sourceSheet:'6.11.69',dispatchedAt,processedAt:dispatchedAt,historySavedAt:dispatchedAt,historySnapshot:{original:true}} as any,
  shipment:{tracking,orderId:'order1',importId:'import1',status:'MATCHED',fulfillmentStatus:'DISPATCHED',dispatchedAt,reportAt:dispatchedAt,dispatchEvidence:'Original dispatch'} as any,
  order:{id:'order1',messageKey:'message1',orderNumber:'ORDER1',eventAt:new Date(now-3*day),createdAt:new Date(now-3*day),status:'TRANSFER_RECORDED',payment:'โอน',affiliateId:null} as any,
  reservation:null as any,rows,operations:new Map<string,any>(),audits:new Map<string,any>(),markers:new Map<string,any>(),sheets:new Map<number,any>(),events:[] as string[],failHistory:false,failArchive:false,loseArchive:false,failRestore:false,loseRestore:false,failFinal:false,networkCalls:0
 };
 state.sheets.set(5,{sheetId:5,title:'6.11.69',rows,formulas:new Set([2]),available:new Set([2])});
 replace(t,db,'$transaction',async(fn:any)=>fn(db));replace(t,db,'$queryRawUnsafe',async()=>[{locked:true}]);
 replace(t,db.stockWorkflow,'findUnique',async()=>({enabled:true,sourceSheet:'6.11.69',activeFrom:new Date(now-30*day)}));
 replace(t,db.stockIntegrationConfig,'findUnique',async()=>({enabled:true,activeFrom:new Date(now-30*day)}));
 replace(t,db.stockHistoryConfig,'findUnique',async()=>null);
 replace(t,db.stockReturn,'findUnique',async()=>state.row);replace(t,db.stockReturn,'findUniqueOrThrow',async()=>state.row);replace(t,db.stockReturn,'findFirst',async()=>state.row);
 replace(t,db.stockReturn,'findMany',async()=>state.row.stage==='RECEIVED'&&!['POSTED','NO_STOCK_CHANGE'].includes(state.row.status)?[state.row]:[]);
 replace(t,db.stockReturn,'update',async({data}:any)=>{
  if(data.historySavedAt){if(state.failHistory)throw Error('History unavailable');state.events.push('history');}
  if(data.status==='POSTED'&&state.failFinal){state.failFinal=false;throw Error('Final DB unavailable');}
  state.row={...state.row,...data};return state.row;
 });
 replace(t,db.stockReturn,'updateMany',async({data}:any)=>{if(['POSTED','NO_STOCK_CHANGE'].includes(state.row.status))return {count:0};state.row={...state.row,...data};return {count:1};});
 replace(t,db.stockDispatch,'findUnique',async()=>state.dispatch);replace(t,db.stockDispatch,'update',async({data}:any)=>state.dispatch={...state.dispatch,...data});replace(t,db.stockDispatch,'updateMany',async({data}:any)=>{state.dispatch={...state.dispatch,...data};return {count:1};});
 for(const [model,key]of [[db.shipment,'shipment'],[db.orderIntake,'order']]as const){
  replace(t,model,'findUnique',async()=>state[key]);replace(t,model,'findUniqueOrThrow',async()=>state[key]);replace(t,model,'update',async({data}:any)=>(state as any)[key]={...state[key],...data});
 }
 replace(t,db.stockReservation,'findUnique',async()=>state.reservation);replace(t,db.stockReservation,'findUniqueOrThrow',async()=>{assert.ok(state.reservation);return state.reservation;});replace(t,db.stockReservation,'update',async({data}:any)=>state.reservation={...state.reservation,...data});replace(t,db.stockReservation,'updateMany',async({data}:any)=>{if(state.reservation)state.reservation={...state.reservation,...data};return {count:state.reservation?1:0};});
 replace(t,db.salesOrder,'findUnique',async()=>null);replace(t,db.salesOrder,'updateMany',async()=>({count:0}));
 replace(t,db.auditLog,'upsert',async({where,create}:any)=>{if(!state.audits.has(where.id))state.audits.set(where.id,create);return state.audits.get(where.id);});
 replace(t,db.auditLog,'create',async({data}:any)=>{state.audits.set('audit'+state.audits.size,data);return data;});
 replace(t,db.stockSheetOperation,'findUnique',async({where}:any)=>state.operations.get(where.id)??null);replace(t,db.stockSheetOperation,'findUniqueOrThrow',async({where}:any)=>{const row=state.operations.get(where.id);assert.ok(row);return row;});
 replace(t,db.stockSheetOperation,'upsert',async({where,create,update}:any)=>{const old=state.operations.get(where.id),row=old?{...old,...update}:{status:'PREPARED',...create};state.operations.set(where.id,row);return row;});
 replace(t,db.stockSheetOperation,'update',async({where,data}:any)=>{const row={...state.operations.get(where.id),...data};state.operations.set(where.id,row);return row;});
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 replace(t,db.stockSheetsConnection,'findUnique',async()=>({revision:'return-'+Math.random(),encryptedConfig:encryptGmail({type:'service_account',client_email:'test@example.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})})}));
 const refresh=(sheet:any)=>{for(const row of sheet.formulas)sheet.rows[row][6]=sheet.rows[row][4]-sheet.rows[row][12];for(const row of sheet.available)sheet.rows[row][13]=sheet.rows[row][15]>0?'':sheet.rows[row][6]-sheet.rows[row][5]+sheet.rows[row][14];};
 replace(t,global,'fetch',async(input:any,init:any)=>{
  state.networkCalls++;const url=String(input);
  if(url.includes('oauth2.googleapis.com'))return Response.json({access_token:'test',expires_in:3600});
  if(url.endsWith('/developerMetadata:search')){const key=JSON.parse(init.body).dataFilters[0].developerMetadataLookup.metadataKey;return Response.json({matchedDeveloperMetadata:state.markers.has(key)?[{developerMetadata:state.markers.get(key)}]:[]});}
  if(url.endsWith(':batchUpdate')){
   const requests=JSON.parse(init.body).requests,archive=requests.some((r:any)=>r.appendCells),restore=requests.some((r:any)=>r.updateCells?.start.sheetId===5&&r.updateCells.start.columnIndex===4);
   if(archive&&state.failArchive)throw Error('Archive unavailable');if(restore&&state.failRestore)throw Error('Restore unavailable');
   if(restore){assert.ok(state.row.historySavedAt);assert.ok([...state.sheets.values()].some(s=>s.title.startsWith('รับคืน ')&&s.rows.some((r:any[])=>r[9]===state.row.id)));state.events.push('restore');}
   for(const request of requests){
    if(request.addSheet){const p=request.addSheet.properties;state.sheets.set(p.sheetId,{...p,rows:[],formulas:new Set(),available:new Set()});}
    if(request.updateCells){const {start,rows:incoming}=request.updateCells,sheet=state.sheets.get(start.sheetId);for(const [index,row]of incoming.entries()as any){sheet.rows[start.rowIndex+index]??=[];for(const [column,cell]of row.values.entries()){const v=cell.userEnteredValue;if(v.formulaValue){if(start.columnIndex+column===6)sheet.formulas.add(start.rowIndex+index);else sheet.available.add(start.rowIndex+index);}else sheet.rows[start.rowIndex+index][start.columnIndex+column]=v.numberValue??v.stringValue;}}refresh(sheet);}
    if(request.appendCells){const sheet=state.sheets.get(request.appendCells.sheetId);for(const row of request.appendCells.rows)sheet.rows.push(row.values.map((cell:any)=>cell.userEnteredValue.numberValue??cell.userEnteredValue.stringValue));state.events.push('archive');}
    if(request.createDeveloperMetadata){const marker=request.createDeveloperMetadata.developerMetadata;state.markers.set(marker.metadataKey,marker);}
    if(request.deleteDeveloperMetadata)state.markers.delete(request.deleteDeveloperMetadata.dataFilter.developerMetadataLookup.metadataKey);
   }
   if(archive&&state.loseArchive){state.loseArchive=false;throw Error('Lost archive response');}
   if(restore&&state.loseRestore){state.loseRestore=false;throw Error('Lost restore response');}
   return Response.json({});
  }
  if(url.includes('/values/')){const range=decodeURIComponent(url.split('/values/')[1].split('?')[0]),title=range.match(/^'([^']+)'!/)?.[1],sheet=[...state.sheets.values()].find(s=>s.title===title);assert.ok(sheet);refresh(sheet);return Response.json({values:sheet.rows});}
  return Response.json({sheets:[...state.sheets.values()].map(sheet=>({properties:{sheetId:sheet.sheetId,title:sheet.title,gridProperties:{rowCount:1000,columnCount:26}},developerMetadata:[...state.markers.values()].filter(m=>m.location?.sheetId===sheet.sheetId)}))});
 });
 return state;
}

test('received email restores original quantity and cost once, preserving other demand and original dispatch history',async t=>{
 const h=harness(t),original=structuredClone(h.dispatch),reportedAt=h.row.reportedAt;
 assert.equal((await processStockReturn(tracking,'owner')).status,'POSTED');
 assert.equal(h.rows[2][4],446);assert.equal(h.rows[2][6],446);assert.equal(h.rows[2][5],100);assert.equal(h.rows[2][12],0);assert.equal(h.rows[2][3],99);assert.equal(h.rows[2][1],'New name');
 assert.deepEqual(h.dispatch,original);assert.equal(h.row.items[0].unitCostSatang,150);assert.equal(h.row.totalCostSatang,75000);
 assert.equal(h.row.receivedAt.getTime(),reportedAt.getTime());assert.equal(h.row.historySnapshot.dateBasis,'EMAIL_REPORT_RECEIVED_AT');
 assert.equal(stockReturnExpenses([h.row])[0].amountSatang,-75000);
 assert.ok(h.events.indexOf('history')<h.events.indexOf('archive'));assert.ok(h.events.indexOf('archive')<h.events.indexOf('restore'));
 const archive=[...h.sheets.values()].find(s=>s.title.startsWith('รับคืน '));assert.equal(archive.rows[1][8],-750);assert.equal(archive.rows[1][7],1.5);
 await processStockReturn(tracking,'owner');assert.equal(h.events.filter(e=>e==='restore').length,1);assert.equal(archive.rows.length,2);assert.equal(h.audits.has('stock-return:'+tracking),true);
});
test('transit notification leaves order and stock unchanged; manual receipt confirmation does not itself process stock',async t=>{
 const h=harness(t);h.row.stage='IN_TRANSIT';h.row.evidence=[];
 assert.equal((await processStockReturn(tracking,'owner')).status,'IN_TRANSIT');assert.equal(h.order.status,'TRANSFER_RECORDED');assert.equal(h.networkCalls,0);
 await confirmStockReturnReceived(tracking,'owner');assert.equal(h.row.stage,'RECEIVED');assert.ok(h.row.receivedAt);assert.equal(h.rows[2][4],-54);assert.equal(h.networkCalls,0);
 assert.equal((await processStockReturn(tracking,'owner')).status,'POSTED');assert.equal(h.rows[2][4],446);assert.equal(h.row.historySnapshot.dateBasis,'RECEIVED_AT');
});
test('history and archive failures cannot restore stock; retry keeps immutable archive despite intervening stock receipt',async t=>{
 const h=harness(t);h.failHistory=true;
 assert.equal((await processStockReturn(tracking,'owner')).status,'NEEDS_REVIEW');assert.equal(h.rows[2][4],-54);assert.equal(h.row.historySavedAt,null);
 h.failHistory=false;h.failArchive=true;
 assert.equal((await processStockReturn(tracking,'owner')).status,'NEEDS_REVIEW');assert.equal(h.rows[2][4],-54);const frozen=structuredClone(h.row.historySnapshot);
 h.failArchive=false;h.loseArchive=true;
 assert.equal((await processStockReturn(tracking,'owner')).status,'NEEDS_REVIEW');assert.equal(h.rows[2][4],-54);
 h.rows[2][4]+=100;h.rows[2][6]+=100;h.rows[2][3]=777;h.dispatch.items[0].costSatang=88888;h.dispatch.totalCostSatang=88888;
 assert.equal((await processStockReturn(tracking,'owner')).status,'POSTED');assert.equal(h.rows[2][4],546);assert.equal(h.row.items[0].remainingBefore,46);assert.equal(h.row.items[0].costSatang,75000);
 assert.deepEqual(h.row.historySnapshot,frozen);const archive=[...h.sheets.values()].find(s=>s.title.startsWith('รับคืน '));assert.equal(archive.rows.length,2);assert.equal(archive.rows[1][12],-54);assert.equal(archive.rows[1][13],446);
});
test('lost stock response and final database failure recover without restoring twice, even after live metadata disappears',async t=>{
 const h=harness(t);h.loseRestore=true;
 assert.equal((await processStockReturn(tracking,'owner')).status,'NEEDS_REVIEW');assert.equal(h.rows[2][4],446);
 h.failFinal=true;assert.equal((await processStockReturn(tracking,'owner')).status,'NEEDS_REVIEW');assert.equal(h.rows[2][4],446);
 h.shipment=null;h.dispatch=null;h.rows[2][3]=9999;
 assert.equal((await processStockReturn(tracking,'owner')).status,'POSTED');assert.equal(h.rows[2][4],446);assert.equal(h.events.filter(e=>e==='restore').length,1);assert.equal(h.row.totalCostSatang,75000);
});
test('a return that was never deducted only releases its normal pending reservation and records no cost credit',async t=>{
 const h=harness(t);h.dispatch=null;h.rows[2][5]=600;h.rows[2][13]=-654;
 h.reservation={orderId:'order1',status:'RESERVED',generation:0,precounted:false,needsReconciliation:false,items:[{code:'CG2',quantityMilliG:500000}]};h.operations.set('reserve:order1',{status:'APPLIED'});
 assert.equal((await processStockReturn(tracking,'owner')).status,'NO_STOCK_CHANGE');assert.equal(h.rows[2][4],-54);assert.equal(h.rows[2][6],-54);assert.equal(h.rows[2][5],100);assert.equal(h.reservation.status,'RELEASED');assert.equal(h.row.totalCostSatang,0);assert.deepEqual(stockReturnExpenses([h.row]),[]);
 await processStockReturn(tracking,'owner');assert.equal(h.rows[2][5],100);
});
test('uncertain old dispatch and historical reservations are review-only, never restored or released speculatively',async t=>{
 const h=harness(t);h.dispatch=null;h.reservation={orderId:'order1',status:'RESERVED',precounted:true,needsReconciliation:false,items:[{code:'CG2',quantityMilliG:500000}]};
 assert.equal((await processStockReturn(tracking,'owner')).status,'NEEDS_REVIEW');assert.equal(h.rows[2][4],-54);assert.equal(h.rows[2][5],100);
 h.reservation=null;h.operations.set('dispatch:order1',{id:'dispatch:order1',status:'PREPARED',fingerprint:'missing-marker',snapshot:{}});
 assert.equal((await processStockReturn(tracking,'owner')).status,'NEEDS_REVIEW');assert.equal(h.events.includes('restore'),false);
});
test('normal reservation sync waits while return retry recovers a release after the final transaction rolls back',async t=>{
 const h=harness(t);h.dispatch=null;h.rows[2][5]=600;h.rows[2][13]=-654;
 h.reservation={orderId:'order1',actor:'owner',status:'RESERVED',generation:0,precounted:false,needsReconciliation:false,items:[{code:'CG2',quantityMilliG:500000}]};h.operations.set('reserve:order1',{status:'APPLIED'});
 assert.equal((await processStockReturn(tracking,'owner')).status,'NO_STOCK_CHANGE');assert.equal(h.rows[2][5],100);
 assert.equal(h.operations.get('release:order1')?.status,'APPLIED');
 // The durable Sheets operation survives a failed enclosing DB commit.
 // Roll back its transaction-owned reservation/return state, then let the
 // ordinary background reservation worker run before the return retry.
 h.reservation.status='RESERVED';h.row.status='NEEDS_REVIEW';h.row.processedAt=null;
 const calls=h.networkCalls;
 assert.equal((await syncStockReservation('order1')).status,'RETURN_IN_PROGRESS');assert.equal(h.networkCalls,calls);assert.equal(h.reservation.status,'RESERVED');assert.equal(h.rows[2][5],100);
 assert.equal((await processStockReturn(tracking,'owner')).status,'NO_STOCK_CHANGE');assert.equal(h.reservation.status,'RELEASED');assert.equal(h.rows[2][5],100);assert.equal(h.rows[2][4],-54);
});
test('normal reservation sync cannot release another order pending while return recovery awaits a legacy or flow marker',async t=>{
 for(const kind of ['legacy','flow'])await t.test(kind,async t=>{
  const h=harness(t);h.order.status='RETURNED';h.dispatch.status='NEEDS_REVIEW';h.dispatch.historySavedAt=null;
  h.reservation={orderId:'order1',actor:'owner',status:'RESERVED',generation:0,precounted:false,needsReconciliation:false,items:[{code:'CG2',quantityMilliG:500000}]};
  h.operations.set('reserve:order1',{status:'APPLIED'});
  const original={orderId:'order1',orderNumber:'ORDER1',tracking,payment:'โอน',sourceSheet:'6.11.69',dispatchedAt:h.dispatch.dispatchedAt.toISOString(),processedAt:h.dispatch.processedAt.toISOString(),items:[structuredClone(originalItem)],totalCostSatang:75000};
  if(kind==='legacy'){
   const key='cannexa-stock-out-'+sha(tracking);h.markers.set(key,{metadataKey:key,metadataValue:JSON.stringify(original),location:{spreadsheet:true}});
  }else{
   const id='dispatch:order1',key='stock-flow-'+createHash('sha256').update(JSON.stringify(id)).digest('hex').slice(0,32);
   h.operations.set(id,{id,status:'PREPARED',fingerprint:'original-fingerprint',snapshot:{snapshot:original}});h.markers.set(key,{metadataKey:key,metadataValue:'original-fingerprint',location:{spreadsheet:true}});
  }
  // The original 500 G has already left F; its remaining 100 G belongs to
  // another order. Stale RESERVED bookkeeping must not subtract 500 again.
  assert.equal((await syncStockReservation('order1')).status,'RETURN_IN_PROGRESS');assert.equal(h.networkCalls,0);assert.equal(h.rows[2][5],100);assert.equal(h.rows[2][4],-54);
  assert.equal((await processStockReturn(tracking,'owner')).status,'POSTED');assert.equal(h.rows[2][5],100);assert.equal(h.rows[2][4],446);assert.equal(h.dispatch.status,'POSTED');
 });
});
test('return evidence blocks cancellation release by tracking before order status or linkage catches up',async t=>{
 const h=harness(t);h.order.status='CANCELLED';h.row.orderId=null;
 h.reservation={orderId:'order1',actor:'owner',status:'QUEUED',generation:0,precounted:false,needsReconciliation:false,items:[{code:'CG2',quantityMilliG:500000}]};h.operations.set('reserve:order1',{status:'PREPARED'});
 let where:any;replace(t,db.stockReturn,'findFirst',async(args:any)=>{where=args.where;return args.where.OR.some((key:any)=>key.tracking===tracking)?h.row:null;});
 assert.equal((await syncStockReservation('order1')).status,'RETURN_IN_PROGRESS');assert.ok(where.OR.some((key:any)=>key.tracking===tracking));assert.equal(h.networkCalls,0);assert.equal(h.rows[2][5],100);assert.equal(h.reservation.status,'QUEUED');
});
test('returned shipment status alone defers ordinary release without needing a return row',async t=>{
 const h=harness(t);h.reservation={orderId:'order1',status:'RESERVED'};
 replace(t,db.stockReturn,'findFirst',async()=>null);
 for(const field of ['status','fulfillmentStatus']){
  h.shipment.status='MATCHED';h.shipment.fulfillmentStatus='DISPATCHED';h.shipment[field]='RETURNED';
  assert.equal((await syncStockReservation('order1')).status,'RETURN_IN_PROGRESS');assert.equal(h.networkCalls,0);assert.equal(h.rows[2][5],100);assert.equal(h.reservation.status,'RESERVED');
 }
});
test('proven outbound operation is recovered before receiving the return, including a lost native response',async t=>{
 for(const status of ['APPLIED','PREPARED'])await t.test(status,async t=>{
  const h=harness(t);h.dispatch.status='HISTORY_SAVED';
  const original={orderId:'order1',orderNumber:'ORDER1',tracking,payment:'โอน',sourceSheet:'6.11.69',dispatchedAt:h.dispatch.dispatchedAt.toISOString(),processedAt:h.dispatch.processedAt.toISOString(),items:[structuredClone(originalItem)],totalCostSatang:75000};
  const id='dispatch:order1',key='stock-flow-'+createHash('sha256').update(JSON.stringify(id)).digest('hex').slice(0,32);
  h.operations.set(id,{id,status,appliedAt:new Date(),fingerprint:'original-fingerprint',snapshot:{snapshot:original}});
  if(status==='PREPARED')h.markers.set(key,{metadataKey:key,metadataValue:'original-fingerprint',location:{spreadsheet:true}});
  assert.equal((await processStockReturn(tracking,'owner')).status,'POSTED');
  assert.equal(h.dispatch.status,'POSTED');assert.equal(h.rows[2][4],446);assert.equal(h.events.filter(e=>e==='restore').length,1);
 });
});
test('legacy outbound native marker is recovered even without saved dispatch history or a flow operation',async t=>{
 const h=harness(t);h.dispatch.status='NEEDS_REVIEW';h.dispatch.historySavedAt=null;
 const original={orderId:'order1',orderNumber:'ORDER1',tracking,payment:'โอน',sourceSheet:'6.11.69',dispatchedAt:h.dispatch.dispatchedAt.toISOString(),processedAt:h.dispatch.processedAt.toISOString(),items:[structuredClone(originalItem)],totalCostSatang:75000};
 const key='cannexa-stock-out-'+sha(tracking);h.markers.set(key,{metadataKey:key,metadataValue:JSON.stringify(original),location:{spreadsheet:true}});
 assert.equal((await processStockReturn(tracking,'owner')).status,'POSTED');assert.equal(h.dispatch.status,'POSTED');assert.equal(h.rows[2][4],446);
});
test('markerless saved outbound history is excluded and reviewed without either stock movement',async t=>{
 const h=harness(t);h.dispatch.status='HISTORY_SAVED';h.operations.set('dispatch:order1',{id:'dispatch:order1',status:'PREPARED',fingerprint:'never-written',snapshot:{}});
 assert.equal((await processStockReturn(tracking,'owner')).status,'NEEDS_REVIEW');assert.equal(h.dispatch.status,'EXCLUDED');assert.equal(h.rows[2][4],-54);assert.equal(h.rows[2][5],100);assert.equal(h.events.includes('restore'),false);
});
test('old or chronologically invalid return reports do not close orders or change stock',async t=>{
 const h=harness(t);h.row.reportedAt=new Date(h.order.eventAt.getTime()-1);
 assert.equal((await processStockReturn(tracking,'owner')).status,'NEEDS_REVIEW');assert.equal(h.order.status,'TRANSFER_RECORDED');assert.equal(h.networkCalls,0);
 h.row.receivedAt=new Date();h.row.reportedAt=new Date(h.shipment.dispatchedAt.getTime()-1);
 assert.equal((await processStockReturn(tracking,'owner')).status,'NEEDS_REVIEW');assert.equal(h.order.status,'TRANSFER_RECORDED');assert.equal(h.networkCalls,0);
});
test('missing SKU, unknown balance and unrecognized receipt evidence stay review-only',async t=>{
 const h=harness(t);h.row.evidence=[];
 assert.equal((await processStockReturn(tracking,'owner')).status,'NEEDS_REVIEW');assert.equal(h.order.status,'TRANSFER_RECORDED');
 h.row.evidence=[{kind:'MANUAL_RECEIPT'}];h.rows[2][2]='OTHER';
 assert.equal((await processStockReturn(tracking,'owner')).status,'NEEDS_REVIEW');assert.equal(h.row.historySavedAt,null);
 h.rows[2][2]='CG2';h.rows[2][4]=null;h.rows[2][6]=null;h.sheets.get(5).formulas.clear();
 assert.equal((await processStockReturn(tracking,'owner')).status,'NEEDS_REVIEW');assert.equal(h.events.includes('restore'),false);
});
test('native archive validation includes original costs and saved balance columns before restoration',async t=>{
 const h=harness(t);h.failRestore=true;await processStockReturn(tracking,'owner');
 const saved=stockReturnArchive(h.row.historySnapshot,h.row.historySavedAt),sheet=h.sheets.get(saved.sheetId);sheet.rows[1][10]=999;
 h.failRestore=false;assert.equal((await processStockReturn(tracking,'owner')).status,'NEEDS_REVIEW');assert.equal(h.rows[2][4],-54);
});
test('pending worker processes received returns and reports completed credits',async t=>{
 const h=harness(t);const result=await processPendingStockReturns('worker',1);
 assert.deepEqual(result,{processed:1,posted:1,noStockChange:0});assert.equal(h.row.status,'POSTED');
});
