import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {db} from '../src/lib/db';
import {encryptGmail} from '../src/lib/gmail';
import {activateStockFlow,queueStockOrder,syncStockReservation,assertNoStockReservations} from '../src/lib/stock-flow';
import {reconcileAlreadyCounted} from '../src/lib/stock-reconcile';
import {restorePendingOrders} from '../src/lib/stock-restore-pending';
import {STOCK_UNVERIFIED_HEADER} from '../src/lib/stock-available';
import {processStockDispatch} from '../src/lib/stock-dispatch';
import {flowBaselinePlan,flowReservationPlan,flowDispatchPlan,STOCK_COMPLETED_HEADER} from '../src/lib/stock-flow-plan';
import {stockRows} from '../src/lib/stock-import';
import {stockReceiptPlan} from '../src/lib/stock-receipt';
import {newStockProduct} from '../src/lib/stock-product-input';
import {stockHistorySnapshot} from '../src/lib/stock-history-plan';
import {stockCostExpenses} from '../src/lib/stock-cost-expenses';
import {confirmReportedShipment} from '../src/lib/shipment-report-confirmation';
import {actOnStockReview} from '../src/lib/stock-review-actions';
import {getOrderStockNotice,stockNoticeText} from '../src/lib/order-stock-notice';
test('new LINE stock notice reserves once, uses 50G sellable stock and preserves physical stock on retry',async t=>{
 const h=await harness(t);
 replace(t,db,'$queryRawUnsafe',async()=>[{locked:true}]);
 replace(t,db.auditLog,'findUnique',async({where}:any)=>h.audits.get(where.id)??null);
 h.addOrder('earlier',440);await queueStockOrder('earlier');await syncStockReservation('earlier');
 h.addOrder('new-order',100);
 const result=await getOrderStockNotice('new-order');assert.match(stockNoticeText(result),/เหลือเพียง 50 กรัม ไม่พอขาย.*ขาด 50 กรัม/);
 assert.equal(h.rows[2][5],540);assert.equal(h.rows[2][6],490);assert.equal(h.rows[2][13],-50);
 h.addOrder('later',50);await queueStockOrder('later');await syncStockReservation('later');
 assert.deepEqual(await getOrderStockNotice('new-order'),result);assert.equal(h.rows[2][5],590);assert.equal(h.rows[2][6],490);
});
function replace(t:TestContext,target:any,key:string,value:any){const before=target[key];target[key]=value;t.after(()=>{target[key]=before;});}
test('edited reservation recovers an applied sheet update once and cancellation releases the revised quantity',async t=>{
 const h=await harness(t);h.addOrder('edited',20);await queueStockOrder('edited');await syncStockReservation('edited');
 const old=h.reservations.get('edited');
 h.reservations.set('edited',{...old,status:'QUEUED',generation:1,items:[{code:'A1',quantityMilliG:30000}],adjustmentFrom:{items:old.items,precounted:false}});
 const update=db.stockReservation.update;let fail=true;
 replace(t,db.stockReservation,'update',async(args:any)=>{if(args.data.status==='RESERVED'&&fail){fail=false;throw Error('simulated lost final write');}return update(args);});
 assert.equal((await syncStockReservation('edited')).status,'NEEDS_REVIEW');
 assert.equal(h.rows[2][5],30);
 assert.equal((await syncStockReservation('edited')).status,'RESERVED');
 assert.equal(h.rows[2][5],30);
 h.orders.get('edited').status='CANCELLED';
 assert.equal((await syncStockReservation('edited')).status,'RELEASED');assert.equal(h.rows[2][5],0);
});
const fresh=():any[][]=>[[null,null,'รายการ',null,'จำนวนรับ','จำนวนจ่าย','จำนวนคงเหลือ',null,null,null,null,null,null],['','','','','','','','','10G','50G','100G','1 KG'],['','Example','A1',1.5,500,10,490,'',300,500,800,2000]];
const source=(rows:any[][])=>({tab:{sheetId:5,title:'5.11.69'},rows,products:stockRows(rows,{costColumnConfirmed:true})});
async function harness(t:TestContext){
 const originalSecret=process.env.SESSION_SECRET;process.env.SESSION_SECRET='stock-flow-test';
 t.after(()=>{if(originalSecret===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=originalSecret;});
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 replace(t,db.stockSheetsConnection,'findUnique',async()=>({revision:'flow-test-'+Math.random(),encryptedConfig:encryptGmail({type:'service_account',client_email:'test@example.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})})}));
 const state={workflow:null as any,rows:fresh(),operations:new Map<string,any>(),reservations:new Map<string,any>(),dispatches:new Map<string,any>(),orders:new Map<string,any>(),shipments:new Map<string,any>(),audits:new Map<string,any>(),sheets:new Map<number,any>(),markers:new Map<string,any>(),events:[] as string[],failHistory:false,failArchive:false,loseDeduction:false,failFinal:false,loseReconcile:false};
 state.sheets.set(5,{sheetId:5,title:'5.11.69',rows:state.rows,formulas:new Set<number>(),availableFormulas:new Set<number>()});
 replace(t,db,'$transaction',async(fn:any)=>fn(db));
 replace(t,db,'$queryRawUnsafe',async()=>[]);
 replace(t,db.stockHistoryConfig,'findUnique',async()=>null);
 replace(t,db.stockWorkflow,'findUnique',async()=>state.workflow);
 const returns=new Map<string,any>();
 replace(t,db.stockReturn,'findFirst',async({where}:any)=>[...returns.values()].find(r=>where.OR.some((key:any)=>key.orderId===r.orderId||key.tracking&&key.tracking===r.tracking))??null);
 replace(t,db.stockWorkflow,'upsert',async({create,update}:any)=>state.workflow=state.workflow?{...state.workflow,...update}:create);
 replace(t,db.stockIntegrationConfig,'findUnique',async()=>({enabled:true,activeFrom:new Date('2026-01-01')}));
 replace(t,db.orderRoundSettings,'findUnique',async()=>({closeMinutes:720,version:null}));
 replace(t,db.orderIntake,'findUnique',async({where}:any)=>state.orders.get(where.id));
 replace(t,db.shipment,'findUnique',async({where}:any)=>state.shipments.get(where.orderId));
 replace(t,db.gmailImport,'findUnique',async()=>({kind:'SHIPMENT'}));
 replace(t,db.auditLog,'upsert',async({where,create}:any)=>{if(!state.audits.has(where.id))state.audits.set(where.id,create);return state.audits.get(where.id);});
 for(const [model,map,key]of [[db.stockSheetOperation,state.operations,'id'],[db.stockReservation,state.reservations,'orderId'],[db.stockDispatch,state.dispatches,'orderId']]as any[]){
  const find=({where}:any)=>where[key]?map.get(where[key]):[...map.values()].find((v:any)=>v.tracking===where.tracking);
  replace(t,model,'findUnique',async(arg:any)=>find(arg)??null);
  replace(t,model,'findUniqueOrThrow',async(arg:any)=>{const v=find(arg);if(!v)throw Error('Not found');return v;});
  replace(t,model,'findMany',async()=>[...map.values()]);
  replace(t,model,'upsert',async({where,create,update}:any)=>{const prior=find({where});if(prior){Object.assign(prior,update);return prior;}const v={status:key==='orderId'?(model===db.stockDispatch?'PENDING':'QUEUED'):'PREPARED',items:[],issues:[],id:create[key],...create};map.set(v[key],v);return v;});
  replace(t,model,'update',async({where,data}:any)=>{
   if(model===db.stockDispatch&&data.historySavedAt){if(state.failHistory)throw Error('History DB unavailable');state.events.push('historyDb');}
   if(model===db.stockDispatch&&data.status==='POSTED'&&state.failFinal){state.failFinal=false;throw Error('Final DB unavailable');}
   const previous=find({where});assert.ok(previous);const next={...previous,...data};map.set(previous[key],next);return next;
  });
  replace(t,model,'updateMany',async({where,data}:any)=>{const rows=where[key]?.in?[...map.values()].filter((r:any)=>where[key].in.includes(r[key])):[find({where})];let count=0;for(const row of rows){if(row&&!(where.status?.not===row.status)){Object.assign(row,data);count++;}}return {count};});
 }
 const refresh=(sheet:any)=>{for(const i of sheet.formulas)sheet.rows[i][6]=Math.round((Number(sheet.rows[i][4])-Number(sheet.rows[i][12]))*1000)/1000;for(const i of sheet.availableFormulas)sheet.rows[i][13]=Number(sheet.rows[i][15]??0)>0?'':Math.round((Number(sheet.rows[i][6])-Number(sheet.rows[i][5])+Number(sheet.rows[i][14]??0))*1000)/1000;};
 replace(t,global,'fetch',async(input:any,init:any)=>{
  const url=String(input);if(url.includes('oauth2.googleapis.com'))return Response.json({access_token:'test',expires_in:3600});
  if(url.endsWith('/developerMetadata:search')){
   const key=JSON.parse(init.body).dataFilters[0].developerMetadataLookup.metadataKey;
   return Response.json({matchedDeveloperMetadata:state.markers.has(key)?[{developerMetadata:state.markers.get(key)}]:[]});
  }
  if(url.endsWith(':batchUpdate')){
   const requests=JSON.parse(init.body).requests;
   const archive=requests.some((r:any)=>r.appendCells&&r.appendCells.sheetId!==5);
   if(archive&&state.failArchive)throw Error('Archive unavailable');
   const dispatchOperation=[...state.operations.values()].find(op=>op.kind==='DISPATCH'&&requests.some((r:any)=>r.createDeveloperMetadata?.developerMetadata.metadataValue===op.fingerprint));
   const deduction=!!dispatchOperation;
   if(dispatchOperation){
    const orderId=dispatchOperation.id.slice('dispatch:'.length),dispatch=state.dispatches.get(orderId);
    assert.ok(dispatch?.historySavedAt);
    assert.ok([...state.sheets.values()].some(sheet=>sheet.title.startsWith('จัดส่ง ')&&sheet.rows.some((row:any[])=>row[9]===orderId)));
    assert.ok(state.events.includes('historyDb'));assert.ok(state.events.includes('archive'));state.events.push('deduction');
   }
   if(archive)state.events.push('archive');
   for(const r of requests){
    if(r.addSheet){const p=r.addSheet.properties;state.sheets.set(p.sheetId,{...p,rows:[],formulas:new Set<number>(),availableFormulas:new Set<number>()});}
    if(r.updateCells){const {start,rows}=r.updateCells,s=state.sheets.get(start.sheetId);for(const [ri,row]of rows.entries()){const i=start.rowIndex+ri;s.rows[i]??=[];for(const [ci,cell]of row.values.entries()){const v=cell.userEnteredValue;if(!v)continue;const col=start.columnIndex+ci;if(v.formulaValue){if(col===6)s.formulas.add(i);else{assert.equal(col,13);s.availableFormulas.add(i);}}else s.rows[i][col]=v.numberValue??v.stringValue;}}refresh(s);}
    if(r.appendCells){const s=state.sheets.get(r.appendCells.sheetId);for(const row of r.appendCells.rows)s.rows.push(row.values.map((c:any)=>c.userEnteredValue.numberValue??c.userEnteredValue.stringValue));}
    if(r.createDeveloperMetadata){const m=r.createDeveloperMetadata.developerMetadata;state.markers.set(m.metadataKey,m);}
    if(r.deleteDeveloperMetadata)state.markers.delete(r.deleteDeveloperMetadata.dataFilter.developerMetadataLookup.metadataKey);
   }
   if(state.loseReconcile&&requests.some((r:any)=>r.createDeveloperMetadata)&&[...state.reservations.values()].some(r=>r.status==='RECONCILING')){state.loseReconcile=false;throw Error('Lost reconciliation response');}
   if(deduction&&state.loseDeduction){state.loseDeduction=false;throw Error('Lost Google response');}
   return Response.json({});
  }
  if(url.includes('/values/')){
   const range=decodeURIComponent(url.split('/values/')[1].split('?')[0]),title=range.match(/^'([^']+)'!/)?.[1],s=[...state.sheets.values()].find(s=>s.title===title);assert.ok(s);refresh(s);return Response.json({values:s.rows});
  }
  return Response.json({sheets:[...state.sheets.values()].map(s=>({properties:{sheetId:s.sheetId,title:s.title,gridProperties:{rowCount:1000,columnCount:26}},developerMetadata:[...state.markers.values()].filter(m=>m.location.sheetId===s.sheetId)}))});
 });
 const addOrder=(id:string,quantity=200,tracking='TRACK-'+id)=>{
  const at=new Date(Date.now()+1000);state.orders.set(id,{id,messageKey:'message-'+id,orderNumber:'ORDER-'+id,sellerUsername:'admin-test',createdAt:at,eventAt:at,status:'TRANSFER_RECORDED',payment:'โอน',rawText:'รายการสินค้า\nA1 x '+quantity+' G\nยอดรวม: 300'});
  state.shipments.set(id,{orderId:id,tracking,fulfillmentStatus:'DISPATCHED',dispatchedAt:at,status:'MATCHED',reportAt:at,importId:'import1'});
 };
 const applyRequests=async(requests:unknown[])=>{const result=await fetch('https://sheets.googleapis.com/v4/spreadsheets/test:batchUpdate',{method:'POST',body:JSON.stringify({requests})});assert.equal(result.ok,true);};
 await activateStockFlow('owner');return {...state,state,returns,addOrder,applyRequests};
}

test('a return blocks unfinished outbound history without deducting or discarding pending quantities',async t=>{
 const h=await harness(t);h.addOrder('returning');await queueStockOrder('returning');await syncStockReservation('returning');
 h.state.failArchive=true;assert.equal((await processStockDispatch('returning','owner')).status,'HISTORY_SAVED');
 h.state.failArchive=false;h.returns.set('returning',{id:'r1',orderId:'returning',tracking:'TRACK-returning'});
 assert.equal((await processStockDispatch('returning','owner')).status,'RETURN_IN_PROGRESS');
 assert.equal(h.rows[2][6],490);assert.equal(h.rows[2][5],200);assert.equal(h.events.filter(e=>e==='deduction').length,0);
 assert.ok(h.dispatches.get('returning').historySavedAt);assert.equal(h.dispatches.get('returning').status,'EXCLUDED');
 assert.equal((await processStockDispatch('returning','owner')).status,'RETURN_IN_PROGRESS');
});

test('return recovery finishes a proven lost outbound write without deducting twice',async t=>{
 const h=await harness(t);h.addOrder('returning');await queueStockOrder('returning');await syncStockReservation('returning');
 h.state.loseDeduction=true;assert.equal((await processStockDispatch('returning','owner')).status,'HISTORY_SAVED');
 h.returns.set('returning',{id:'r1',orderId:'returning',tracking:'TRACK-returning'});
 assert.equal((await processStockDispatch('returning','owner')).status,'POSTED');
 assert.equal(h.rows[2][6],290);assert.equal(h.rows[2][5],0);assert.equal(h.events.filter(e=>e==='deduction').length,1);
 assert.equal(h.dispatches.get('returning').totalCostSatang,30000);
});

test('return evidence before dispatch never creates a new outbound write',async t=>{
 const h=await harness(t);h.addOrder('returning');h.returns.set('returning',{id:'r1',tracking:'TRACK-returning'});
 assert.equal((await processStockDispatch('returning','owner')).status,'RETURN_IN_PROGRESS');assert.equal(h.dispatches.size,0);assert.equal(h.rows[2][6],490);
});
test('baseline keeps physical balance, new products use independent completed totals, and malformed baseline fails closed',()=>{
 const rows=fresh(),plan=flowBaselinePlan(source(rows));assert.equal(plan.changes[0].remainingAfter,490);assert.equal(plan.changes[0].pendingAfter,0);assert.equal(plan.changes[0].completedAfter,10);
 rows[0][12]=STOCK_COMPLETED_HEADER;rows[2][12]=10;rows[2][5]=0;
 const s=source(rows),receive=stockReceiptPlan(newStockProduct.parse({requestKey:'ad83d6b7-84b5-4b42-b45f-fdf7285c80cf',code:'A2',name:'New',cost:1.5,quantity:200,prices:[]}),s);
 const added:any=(receive.requests as any[]).find(r=>r.appendCells).appendCells.rows[0].values;assert.equal(added[12].userEnteredValue.numberValue,0);assert.match(added[6].userEnteredValue.formulaValue,/M:M/);
 assert.equal(stockHistorySnapshot('2026-11-05',{...s,readAt:new Date('2026-11-06')},'owner').rows[0][5],'จำนวนรอจ่าย (G)');
 rows[2][12]='taken';assert.throws(()=>flowBaselinePlan(source(rows)));
 const wrong=fresh();wrong[2][6]=10;assert.throws(()=>flowBaselinePlan(source(wrong)),/BASELINE_INCONSISTENT/);
});
test('partial dispatch rolls the received balance forward after history, clears only that order, and preserves availability and archives on replay',async t=>{
 const h=await harness(t);assert.equal(h.rows[2][6],490);assert.equal(h.rows[2][5],0);assert.equal(h.rows[2][12],10);
 assert.equal(h.state.workflow.activeFrom.toISOString(),'2026-01-01T00:00:00.000Z');
 const backup=[...h.sheets.values()].find(s=>s.title.startsWith('ก่อนเริ่มรอบ'));assert.equal(backup.rows[2][5],10);assert.equal(backup.rows[2][6],490);const baselineArchive=structuredClone(backup.rows);
 h.addOrder('o1');h.addOrder('o2',100);await queueStockOrder('o1');await queueStockOrder('o2');await syncStockReservation('o1');await syncStockReservation('o2');await syncStockReservation('o1');
 assert.equal(h.rows[2][5],300);assert.equal(h.rows[2][6],490);assert.equal(h.rows[2][13],190);await assert.rejects(()=>assertNoStockReservations(['A1']),/PENDING_ORDERS/);
 assert.equal((await processStockDispatch('o1','owner')).status,'POSTED');assert.equal(h.rows[2][4],290);assert.equal(h.rows[2][5],100);assert.equal(h.rows[2][6],290);assert.equal(h.rows[2][12],0);assert.equal(h.rows[2][13],190);
 const firstItem=h.dispatches.get('o1').historySnapshot.items[0];assert.equal(firstItem.receivedBefore,500);assert.equal(firstItem.receivedAfter,290);assert.equal(firstItem.completedBefore,10);assert.equal(firstItem.completedAfter,0);
 assert.ok(h.events.indexOf('historyDb')<h.events.indexOf('archive'));assert.ok(h.events.indexOf('archive')<h.events.indexOf('deduction'));
 assert.equal((await processStockDispatch('o1','owner')).status,'POSTED');assert.equal(h.rows[2][4],290);assert.equal(h.rows[2][6],290);assert.equal(h.rows[2][12],0);
 assert.equal((await processStockDispatch('o2','owner')).status,'POSTED');assert.equal(h.rows[2][4],190);assert.equal(h.rows[2][5],0);assert.equal(h.rows[2][6],190);assert.equal(h.rows[2][12],0);assert.equal(h.rows[2][13],190);
 const archived=[...h.sheets.values()].find(s=>s.title.startsWith('จัดส่ง '));assert.equal(archived.rows.length,3);assert.equal(h.dispatches.get('o1').totalCostSatang,30000);
 assert.equal(archived.rows.slice(1).reduce((sum:number,row:any[])=>sum+row[6],0),300);assert.equal(archived.rows.slice(1).reduce((sum:number,row:any[])=>sum+row[8],0),450);
 const shipmentArchive=structuredClone(archived.rows),historySnapshots=structuredClone([...h.dispatches.values()].map(d=>d.historySnapshot));
 h.rows[2][3]=99;await processStockDispatch('o1','owner');await processStockDispatch('o2','owner');
 assert.equal(h.dispatches.get('o1').totalCostSatang,30000);assert.equal(h.dispatches.get('o2').totalCostSatang,15000);
 assert.deepEqual(archived.rows,shipmentArchive);assert.deepEqual(backup.rows,baselineArchive);assert.deepEqual([...h.dispatches.values()].map(d=>d.historySnapshot),historySnapshots);
 assert.equal(h.events.filter(e=>e==='deduction').length,2);
});
test('missing cost waits; history database and Sheets archive failures do not deduct; later retries retain frozen cost',async t=>{
 const h=await harness(t);h.addOrder('o1');await queueStockOrder('o1');await syncStockReservation('o1');h.rows[2][3]=null;
 assert.equal((await processStockDispatch('o1','owner')).status,'WAITING_COST');assert.equal(h.rows[2][5],200);assert.equal(h.rows[2][6],490);assert.ok(!h.events.includes('historyDb'));
 h.rows[2][3]=1.5;h.state.failHistory=true;assert.equal((await processStockDispatch('o1','owner')).status,'NEEDS_REVIEW');assert.equal(h.rows[2][6],490);
 h.state.failHistory=false;h.state.failArchive=true;assert.equal((await processStockDispatch('o1','owner')).status,'HISTORY_SAVED');assert.equal(h.rows[2][4],500);assert.equal(h.rows[2][5],200);assert.equal(h.rows[2][6],490);assert.equal(h.rows[2][12],10);
 h.state.failArchive=false;h.rows[2][3]=9;assert.equal((await processStockDispatch('o1','owner')).status,'POSTED');assert.equal(h.rows[2][4],290);assert.equal(h.rows[2][5],0);assert.equal(h.rows[2][6],290);assert.equal(h.rows[2][12],0);assert.equal(h.dispatches.get('o1').totalCostSatang,30000);
});
test('lost deduction response and final database failure recover without duplicate history, changed cost or consuming another pending order',async t=>{
 const h=await harness(t);h.addOrder('o1');h.addOrder('o2',50);await queueStockOrder('o1');await queueStockOrder('o2');await syncStockReservation('o1');await syncStockReservation('o2');
 h.state.loseDeduction=true;assert.equal((await processStockDispatch('o1','owner')).status,'HISTORY_SAVED');assert.equal(h.rows[2][4],290);assert.equal(h.rows[2][5],50);assert.equal(h.rows[2][6],290);assert.equal(h.rows[2][12],0);
 h.state.failFinal=true;assert.equal((await processStockDispatch('o1','owner')).status,'HISTORY_SAVED');assert.equal(h.rows[2][6],290);
 assert.equal((await processStockDispatch('o1','owner')).status,'POSTED');assert.equal(h.rows[2][4],290);assert.equal(h.rows[2][5],50);assert.equal(h.rows[2][12],0);assert.equal(h.events.filter(e=>e==='deduction').length,1);
 const archived=[...h.sheets.values()].find(s=>s.title.startsWith('จัดส่ง '));assert.equal(archived.rows.length,2);
 h.orders.get('o2').status='CANCELLED';await syncStockReservation('o2');assert.equal(h.rows[2][5],0);assert.equal(h.rows[2][6],290);
 h.addOrder('duplicate',20,'TRACK-o1');assert.equal((await processStockDispatch('duplicate','owner')).status,'NEEDS_REVIEW');assert.equal(h.rows[2][6],290);
});
test('pending demand includes oversold orders; dispatch still requires a matching reservation',async t=>{
 const h=await harness(t);h.addOrder('o1',300);await queueStockOrder('o1');await syncStockReservation('o1');
 h.addOrder('o2',200);await queueStockOrder('o2');assert.equal((await syncStockReservation('o2')).status,'RESERVED');assert.equal(h.rows[2][5],500);assert.equal(h.rows[2][13],-10);
 h.orders.delete('o1');assert.equal((await syncStockReservation('o1')).status,'RELEASED');assert.equal(h.rows[2][5],200);assert.equal(h.rows[2][6],490);
 await syncStockReservation('o2');assert.equal(h.rows[2][5],200);assert.equal(h.rows[2][6],490);
 assert.throws(()=>flowDispatchPlan([{code:'A1',quantityMilliG:300000}],source(h.rows)),/PENDING_MISMATCH/);
 h.rows[2][6]=100;assert.throws(()=>flowReservationPlan([{code:'A1',quantityMilliG:1000}],source(h.rows)),/BALANCE_MISMATCH/);
});

test('confirmed oversold shipments keep negative stock and positive costs, wait for missing cost, and never post twice',async t=>{
 const h=await harness(t);h.rows[2][4]=0;h.rows[2][6]=0;h.rows[2][12]=0;
 h.addOrder('oversold',200);h.shipments.get('oversold').fulfillmentStatus='UNCONFIRMED';h.shipments.get('oversold').dispatchedAt=null;
 await queueStockOrder('oversold');await syncStockReservation('oversold');
 assert.equal(h.rows[2][5],200);assert.equal(h.rows[2][6],0);assert.equal(h.rows[2][13],-200);
 assert.equal((await processStockDispatch('oversold','owner')).status,'NOT_ELIGIBLE');assert.equal(h.dispatches.size,0);
 Object.assign(h.shipments.get('oversold'),{fulfillmentStatus:'DISPATCHED',dispatchedAt:new Date()});
 assert.equal((await processStockDispatch('oversold','owner')).status,'POSTED');
 assert.equal(h.rows[2][4],-200);assert.equal(h.rows[2][5],0);assert.equal(h.rows[2][6],-200);assert.equal(h.rows[2][12],0);assert.equal(h.rows[2][13],-200);
 assert.equal(h.dispatches.get('oversold').totalCostSatang,30000);
 assert.ok(h.events.indexOf('historyDb')<h.events.indexOf('archive'));assert.ok(h.events.indexOf('archive')<h.events.indexOf('deduction'));
 h.addOrder('waiting-cost',50);await queueStockOrder('waiting-cost');await syncStockReservation('waiting-cost');h.rows[2][3]=null;
 assert.equal((await processStockDispatch('waiting-cost','owner')).status,'WAITING_COST');assert.equal(h.rows[2][6],-200);assert.equal(h.rows[2][5],50);assert.equal(h.rows[2][13],-250);
 h.rows[2][3]=2;
 assert.equal((await processStockDispatch('waiting-cost','owner')).status,'POSTED');assert.equal(h.rows[2][4],-250);assert.equal(h.rows[2][6],-250);assert.equal(h.rows[2][5],0);assert.equal(h.rows[2][12],0);
 assert.equal(h.dispatches.get('waiting-cost').totalCostSatang,10000);
 h.rows[2][3]=9;await processStockDispatch('oversold','owner');await processStockDispatch('waiting-cost','owner');
 assert.equal(h.rows[2][6],-250);assert.equal(h.events.filter(e=>e==='deduction').length,2);
 const expenses=stockCostExpenses([...h.dispatches.values()]);assert.equal(expenses.length,2);assert.equal(expenses.reduce((total,e)=>total+e.amountSatang,0),40000);
 const restock=stockReceiptPlan(newStockProduct.parse({requestKey:'ad83d6b7-84b5-4b42-b45f-fdf7285c80cf',code:'A1',cost:9,quantity:250,prices:[]}),source(h.rows));
 assert.equal(restock.result.remainingAfter,0);assert.equal(restock.result.receivedBefore,-250);assert.equal(restock.result.receivedAfter,0);
 await h.applyRequests(restock.requests);assert.equal(h.rows[2][4],0);assert.equal(h.rows[2][6],0);assert.equal(h.rows[2][12],0);assert.equal(h.rows[2][13],0);
 assert.equal(h.events.filter(e=>e==='deduction').length,2);
});

test('receiving a new round adds to the carried balance and subsequent dispatch preserves the remaining order',async t=>{
 const h=await harness(t);h.addOrder('first',200);await queueStockOrder('first');await syncStockReservation('first');
 assert.equal((await processStockDispatch('first','owner')).status,'POSTED');assert.equal(h.rows[2][4],290);assert.equal(h.rows[2][12],0);
 const archived=[...h.sheets.values()].find(s=>s.title.startsWith('จัดส่ง ')),firstArchive=structuredClone(archived.rows[1]),firstHistory=structuredClone(h.dispatches.get('first').historySnapshot);
 const receipt=stockReceiptPlan(newStockProduct.parse({requestKey:'ad83d6b7-84b5-4b42-b45f-fdf7285c80cf',code:'A1',cost:9,quantity:100,prices:[]}),source(h.rows));
 assert.equal(receipt.result.receivedBefore,290);assert.equal(receipt.result.receivedAfter,390);assert.equal(receipt.result.remainingAfter,390);
 await h.applyRequests(receipt.requests);assert.equal(h.rows[2][4],390);assert.equal(h.rows[2][6],390);assert.equal(h.rows[2][12],0);assert.equal(h.rows[2][13],390);
 for(const [id,quantity]of [['next',50],['pending',25]]as const){h.addOrder(id,quantity);await queueStockOrder(id);await syncStockReservation(id);}
 assert.equal(h.rows[2][5],75);assert.equal(h.rows[2][13],315);
 assert.equal((await processStockDispatch('next','owner')).status,'POSTED');
 assert.equal(h.rows[2][4],340);assert.equal(h.rows[2][5],25);assert.equal(h.rows[2][6],340);assert.equal(h.rows[2][12],0);assert.equal(h.rows[2][13],315);
 assert.equal(h.reservations.get('pending').status,'RESERVED');assert.equal(h.events.filter(e=>e==='deduction').length,2);
 assert.deepEqual(archived.rows[1],firstArchive);assert.deepEqual(h.dispatches.get('first').historySnapshot,firstHistory);assert.equal(h.dispatches.get('first').totalCostSatang,30000);
});
test('explicitly included old pending orders can dispatch later without backdating completed shipments',async t=>{
 const h=await harness(t);h.addOrder('old',20);
 Object.assign(h.orders.get('old'),{createdAt:new Date('2025-01-01'),eventAt:new Date('2025-01-01')});
 assert.equal((await processStockDispatch('old','owner')).status,'NOT_ELIGIBLE');
 assert.equal(await queueStockOrder('old'),null);
 await queueStockOrder('old',true);
 assert.equal((await processStockDispatch('old','owner')).status,'POSTED');
 assert.equal(h.rows[2][6],470);
 h.addOrder('historical',20);h.shipments.get('historical').dispatchedAt=new Date('2025-01-01');
 await queueStockOrder('historical',true);
 assert.equal((await processStockDispatch('historical','owner')).status,'NOT_ELIGIBLE');
 assert.equal(h.rows[2][6],470);
});
test('already-counted reconciliation removes only duplicate pending demand and blocks later retries and dispatches',async t=>{
 const h=await harness(t);
 for(const [id,qty] of [['old1',100],['old2',50],['new',20]] as const){h.addOrder(id,qty);await queueStockOrder(id,true);await syncStockReservation(id);}
 h.addOrder('missing',10);h.orders.get('missing').rawText='รายการสินค้า\nMISSING x 10 G\nยอดรวม: 100';await queueStockOrder('missing',true);await syncStockReservation('missing');
 assert.equal(h.rows[2][5],170);
 const request={requestKey:'same-request',orderIds:['old1','old2','missing']};
 const result=await reconcileAlreadyCounted(request,'owner');assert.equal(result.releasedQuantityG,150);
 assert.equal(h.rows[2][5],20);assert.equal(h.rows[2][6],490);assert.equal(h.rows[2][12],10);assert.equal(h.rows[2][13],470);
 for(const id of request.orderIds){assert.equal(h.reservations.get(id).status,'ALREADY_COUNTED');assert.equal((await queueStockOrder(id,true))?.status,'ALREADY_COUNTED');assert.equal((await syncStockReservation(id)).status,'ALREADY_COUNTED');assert.equal((await processStockDispatch(id,'owner')).status,'ALREADY_COUNTED');assert.ok(!h.dispatches.has(id));}
 assert.equal((await reconcileAlreadyCounted(request,'owner')).replayed,true);assert.equal(h.rows[2][5],20);
 assert.equal([...h.audits.values()].filter(a=>a.action==='STOCK_ALREADY_COUNTED').length,3);
 await assert.rejects(()=>reconcileAlreadyCounted({...request,orderIds:['new']},'owner'),/REQUEST_CHANGED/);
 assert.equal((await processStockDispatch('new','owner')).status,'POSTED');assert.equal(h.rows[2][5],0);assert.equal(h.rows[2][6],470);
 await assert.rejects(()=>reconcileAlreadyCounted({requestKey:'completed',orderIds:['new']},'owner'),/DISPATCH_ALREADY_STARTED/);
});
test('lost reconciliation response blocks dispatch and recovers without releasing unrelated quantities twice',async t=>{
 const h=await harness(t);for(const id of ['old','new']){h.addOrder(id,30);await queueStockOrder(id,true);await syncStockReservation(id);}
 const request={requestKey:'recover-request',orderIds:['old']};h.state.loseReconcile=true;
 await assert.rejects(()=>reconcileAlreadyCounted(request,'owner'),/Lost reconciliation/);
 assert.equal(h.reservations.get('old').status,'RECONCILING');assert.equal(h.rows[2][5],30);
 assert.equal((await processStockDispatch('old','owner')).status,'RECONCILING');assert.equal((await syncStockReservation('old')).status,'RECONCILING');
 await assert.rejects(()=>reconcileAlreadyCounted({...request,requestKey:'different'},'owner'),/RECONCILIATION_IN_PROGRESS/);
 await reconcileAlreadyCounted(request,'owner');assert.equal(h.reservations.get('old').status,'ALREADY_COUNTED');assert.equal(h.rows[2][5],30);assert.equal(h.rows[2][6],490);
});
test('LINE intake alone never records shipping history or deducts physical stock before actual dispatch',async t=>{
 const h=await harness(t);h.addOrder('new',20);h.shipments.get('new').fulfillmentStatus='UNCONFIRMED';h.shipments.get('new').dispatchedAt=null;
 await queueStockOrder('new');await syncStockReservation('new');
 assert.equal(h.rows[2][5],20);assert.equal(h.rows[2][6],490);
 assert.equal((await processStockDispatch('new','owner')).status,'NOT_ELIGIBLE');assert.equal(h.dispatches.size,0);assert.ok(!h.events.includes('historyDb'));
 Object.assign(h.shipments.get('new'),{fulfillmentStatus:'DISPATCHED',dispatchedAt:new Date()});
 assert.equal((await processStockDispatch('new','owner')).status,'POSTED');assert.equal(h.rows[2][6],470);assert.equal(h.rows[2][5],0);
});

test('manual tracking dispatch deducts once without an email shipment report',async t=>{
 const h=await harness(t);h.addOrder('manual',20);
 h.shipments.get('manual').importId='manual-upload';
 replace(t,db.gmailImport,'findUnique',async()=>null);
 await queueStockOrder('manual');await syncStockReservation('manual');
 assert.equal((await processStockDispatch('manual','owner')).status,'POSTED');
 assert.equal(h.rows[2][6],470);assert.equal(h.rows[2][5],0);
 assert.equal(h.reservations.get('manual').status,'CONSUMED');
 assert.equal((await processStockDispatch('manual','owner')).status,'POSTED');
 assert.equal(h.rows[2][6],470);
 assert.equal(h.events.filter(event=>event==='deduction').length,1);
});
test('rolling dispatch retains only residual precounted credits and never deducts restored orders twice, including after a lost response',async t=>{
 const h=await harness(t);h.addOrder('precounted',3);h.addOrder('precounted-later',5);h.addOrder('normal',20);
 const orderIds=['precounted','precounted-later','normal'];
 for(const id of orderIds){await queueStockOrder(id,true);await syncStockReservation(id);}
 await reconcileAlreadyCounted({requestKey:'prior',orderIds},'owner');
 const request={requestKey:'restore',orderIds,precountedOrderIds:['precounted','precounted-later'],reviewOrderIds:[]};
 await restorePendingOrders(request,'owner');
 for(const id of request.orderIds){assert.equal(h.reservations.get(id).generation,1);await syncStockReservation(id);}
 assert.equal(h.rows[2][5],28);assert.equal(h.rows[2][14],8);assert.equal(h.rows[2][6],490);assert.equal(h.rows[2][13],470);
 await restorePendingOrders(request,'owner');assert.equal(h.reservations.get('normal').status,'RESERVED');assert.equal(h.rows[2][5],28);
 await assert.rejects(()=>reconcileAlreadyCounted({requestKey:'prior',orderIds:request.orderIds},'owner'),/SUPERSEDED/);
 h.state.loseDeduction=true;assert.equal((await processStockDispatch('precounted','owner')).status,'HISTORY_SAVED');
 assert.equal(h.rows[2][4],495);assert.equal(h.rows[2][5],25);assert.equal(h.rows[2][14],5);assert.equal(h.rows[2][6],490);assert.equal(h.rows[2][12],5);assert.equal(h.rows[2][13],470);
 assert.equal((await processStockDispatch('precounted','owner')).status,'POSTED');assert.equal(h.rows[2][4],495);assert.equal(h.rows[2][6],490);assert.equal(h.rows[2][12],5);
 assert.equal((await processStockDispatch('normal','owner')).status,'POSTED');
 assert.equal(h.rows[2][4],475);assert.equal(h.rows[2][5],5);assert.equal(h.rows[2][6],470);assert.equal(h.rows[2][12],5);assert.equal(h.rows[2][14],5);assert.equal(h.rows[2][13],470);
 assert.equal((await processStockDispatch('precounted-later','owner')).status,'POSTED');
 assert.equal(h.rows[2][4],470);assert.equal(h.rows[2][5],0);assert.equal(h.rows[2][6],470);assert.equal(h.rows[2][12],0);assert.equal(h.rows[2][14],0);assert.equal(h.rows[2][13],470);
 assert.equal(h.events.filter(e=>e==='deduction').length,3);assert.equal([...h.sheets.values()].find(s=>s.title.startsWith('จัดส่ง ')).rows.length,4);
});
test('unmatched legacy deductions remain visibly pending by order while preventing guessed availability and stock-out',async t=>{
 const h=await harness(t);h.addOrder('uncertain',30);await queueStockOrder('uncertain',true);await syncStockReservation('uncertain');
 await reconcileAlreadyCounted({requestKey:'prior',orderIds:['uncertain']},'owner');
 await restorePendingOrders({requestKey:'restore',orderIds:['uncertain'],precountedOrderIds:[],reviewOrderIds:['uncertain']},'owner');
 await syncStockReservation('uncertain');assert.equal(h.rows[2][5],30);assert.equal(h.rows[2][15],30);assert.equal(h.rows[2][13],'');assert.equal(h.rows[2][6],490);
 assert.equal((await processStockDispatch('uncertain','owner')).status,'NEEDS_RECONCILIATION');assert.equal(h.dispatches.size,0);
 await syncStockReservation('uncertain');assert.equal(h.rows[2][5],30);
 h.addOrder('new',20);await queueStockOrder('new');await syncStockReservation('new');assert.equal(h.rows[2][5],50);
 assert.equal((await processStockDispatch('new','owner')).status,'POSTED');assert.equal(h.rows[2][5],30);assert.equal(h.rows[2][6],470);assert.equal(h.rows[2][15],30);
});
test('a newly registered code can show order demand without inventing its opening balance or cost',async t=>{
 const h=await harness(t);h.rows[2][4]=null;h.rows[2][6]=null;h.rows[2][3]=null;h.rows[2][12]=0;h.rows[0][15]=STOCK_UNVERIFIED_HEADER;h.rows[2][15]=0;
 h.sheets.get(5).formulas.delete(2);
 h.addOrder('pending',30);await queueStockOrder('pending');h.reservations.get('pending').needsReconciliation=true;
 assert.equal((await syncStockReservation('pending')).status,'RESERVED');
 assert.equal(h.rows[2][5],30);assert.equal(h.rows[2][15],30);assert.equal(h.rows[2][4],null);assert.equal(h.rows[2][6],null);assert.equal(h.rows[2][3],null);assert.equal(h.rows[2][13],'');
 assert.equal((await processStockDispatch('pending','owner')).status,'NEEDS_RECONCILIATION');assert.equal(h.dispatches.size,0);
});

test('email confirmation automatically posts only the matched order and leaves unmatched demand pending',async t=>{
 const h=await harness(t);h.addOrder('reported',20);h.addOrder('unmatched',30);
 for(const id of ['reported','unmatched']){h.orders.get(id).payment='เคลม';Object.assign(h.shipments.get(id),{fulfillmentStatus:'UNCONFIRMED',dispatchedAt:null,status:id==='reported'?'MATCHED_CLAIM':'WAITING_ORDER'});await queueStockOrder(id);await syncStockReservation(id);}
 const reportAt=new Date(Date.now()+2000);h.shipments.get('reported').reportAt=reportAt;
 replace(t,db.shipment,'update',async({where,data}:any)=>{const item=[...h.shipments.values()].find(s=>s.tracking===where.tracking);return Object.assign(item,data);});
 replace(t,db.salesOrder,'findUnique',async()=>null);
 replace(t,db.gmailImport,'findUnique',async()=>({id:'import1',kind:'SHIPMENT',rowCount:1,filename:'freight.xlsx',messageId:'email',reportAt}));
 assert.equal(await confirmReportedShipment('reported','test'),true);assert.equal(await confirmReportedShipment('unmatched','test'),false);
 assert.equal((await processStockDispatch('reported','test')).status,'POSTED');assert.equal(h.rows[2][5],30);assert.equal(h.rows[2][6],470);
 assert.equal(h.dispatches.get('reported').totalCostSatang,3000);assert.equal(h.dispatches.has('unmatched'),false);
 assert.equal(await confirmReportedShipment('reported','test'),false);await processStockDispatch('reported','test');assert.equal(h.rows[2][5],30);assert.equal(h.rows[2][6],470);
});

test('review can hold or cancel an unposted order without clearing another order, and blocks changes after posting',async t=>{
 const h=await harness(t);h.addOrder('review',60);h.addOrder('other',40);
 for(const id of ['review','other']){h.orders.get(id).payment='เคลม';await queueStockOrder(id);await syncStockReservation(id);}
 h.rows[2][3]=null;assert.equal((await processStockDispatch('review','test')).status,'WAITING_COST');
 replace(t,db.orderIntake,'findUniqueOrThrow',async({where}:any)=>h.orders.get(where.id));
 replace(t,db.shipment,'findUniqueOrThrow',async({where}:any)=>h.shipments.get(where.orderId));
 replace(t,db.shipment,'update',async({where,data}:any)=>{const item=where.orderId?h.shipments.get(where.orderId):[...h.shipments.values()].find(s=>s.tracking===where.tracking);return Object.assign(item,data);});
 replace(t,db.orderIntake,'update',async({where,data}:any)=>Object.assign(h.orders.get(where.id),data));
 replace(t,db.salesOrder,'findUnique',async()=>null);replace(t,db.salesOrder,'updateMany',async()=>({count:0}));replace(t,db.auditLog,'create',async()=>({}));
 assert.equal((await actOnStockReview('review','wait','owner','รอส่งรอบถัดไป')).status,'WAITING_SHIPMENT');
 assert.equal(h.rows[2][5],100);assert.equal(h.rows[2][6],490);
 assert.equal((await processStockDispatch('review','test')).status,'WAITING_SHIPMENT');assert.equal(h.rows[2][5],100);
 assert.equal((await actOnStockReview('review','cancel','owner','ลูกค้ายกเลิก')).status,'EXCLUDED');assert.equal(h.rows[2][5],40);assert.equal(h.rows[2][6],490);
 await actOnStockReview('review','cancel','owner','ลูกค้ายกเลิก');assert.equal(h.rows[2][5],40);
 await assert.rejects(()=>actOnStockReview('review','retry','owner',''),/ORDER_CLOSED/);
 h.rows[2][3]=1.5;await processStockDispatch('other','test');assert.equal(h.rows[2][6],450);
 await assert.rejects(()=>actOnStockReview('other','cancel','owner','ยกเลิก'),/STOCK_RESULT_NEEDS_VERIFICATION/);
 assert.equal(h.rows[2][6],450);
});

