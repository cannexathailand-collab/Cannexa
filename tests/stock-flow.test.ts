import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {db} from '../src/lib/db';
import {encryptGmail} from '../src/lib/gmail';
import {activateStockFlow,queueStockOrder,syncStockReservation,assertNoStockReservations} from '../src/lib/stock-flow';
import {processStockDispatch} from '../src/lib/stock-dispatch';
import {flowBaselinePlan,flowReservationPlan,flowDispatchPlan,STOCK_COMPLETED_HEADER} from '../src/lib/stock-flow-plan';
import {stockRows} from '../src/lib/stock-import';
import {stockReceiptPlan} from '../src/lib/stock-receipt';
import {newStockProduct} from '../src/lib/stock-product-input';
import {stockHistorySnapshot} from '../src/lib/stock-history-plan';
function replace(t:TestContext,target:any,key:string,value:any){const before=target[key];target[key]=value;t.after(()=>{target[key]=before;});}
const fresh=():any[][]=>[[null,null,'รายการ',null,'จำนวนรับ','จำนวนจ่าย','จำนวนคงเหลือ',null,null,null,null,null,null],['','','','','','','','','10G','50G','100G','1 KG'],['','Example','A1',1.5,500,10,490,'',300,500,800,2000]];
const source=(rows:any[][])=>({tab:{sheetId:5,title:'5.11.69'},rows,products:stockRows(rows,{costColumnConfirmed:true})});
async function harness(t:TestContext){
 const originalSecret=process.env.SESSION_SECRET;process.env.SESSION_SECRET='stock-flow-test';
 t.after(()=>{if(originalSecret===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=originalSecret;});
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 replace(t,db.stockSheetsConnection,'findUnique',async()=>({revision:'flow-test-'+Math.random(),encryptedConfig:encryptGmail({type:'service_account',client_email:'test@example.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})})}));
 const state={workflow:null as any,rows:fresh(),operations:new Map<string,any>(),reservations:new Map<string,any>(),dispatches:new Map<string,any>(),orders:new Map<string,any>(),shipments:new Map<string,any>(),audits:new Map<string,any>(),sheets:new Map<number,any>(),markers:new Map<string,any>(),events:[] as string[],failHistory:false,failArchive:false,loseDeduction:false,failFinal:false};
 state.sheets.set(5,{sheetId:5,title:'5.11.69',rows:state.rows,formulas:new Set<number>()});
 replace(t,db,'$transaction',async(fn:any)=>fn(db));
 replace(t,db,'$queryRawUnsafe',async()=>[]);
 replace(t,db.stockHistoryConfig,'findUnique',async()=>null);
 replace(t,db.stockWorkflow,'findUnique',async()=>state.workflow);
 replace(t,db.stockWorkflow,'upsert',async({create,update}:any)=>state.workflow=state.workflow?{...state.workflow,...update}:create);
 replace(t,db.stockIntegrationConfig,'findUnique',async()=>({enabled:true,activeFrom:new Date('2026-01-01')}));
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
  replace(t,model,'updateMany',async({where,data}:any)=>{const row=find({where});if(row&&!(where.status?.not===row.status)){Object.assign(row,data);return {count:1};}return {count:0};});
 }
 const refresh=(sheet:any)=>{for(const i of sheet.formulas)sheet.rows[i][6]=Math.round((Number(sheet.rows[i][4])-Number(sheet.rows[i][12]))*1000)/1000;};
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
   const deduction=requests.some((r:any)=>r.updateCells?.start.sheetId===5&&r.updateCells.start.columnIndex===12&&r.updateCells.rows[0].values[0].userEnteredValue.numberValue>10);
   if(deduction){assert.ok(state.events.includes('historyDb'));assert.ok(state.events.includes('archive'));state.events.push('deduction');}
   if(archive)state.events.push('archive');
   for(const r of requests){
    if(r.addSheet){const p=r.addSheet.properties;state.sheets.set(p.sheetId,{...p,rows:[],formulas:new Set<number>()});}
    if(r.updateCells){const {start,rows}=r.updateCells,s=state.sheets.get(start.sheetId);for(const [ri,row]of rows.entries()){const i=start.rowIndex+ri;s.rows[i]??=[];for(const [ci,cell]of row.values.entries()){const v=cell.userEnteredValue;if(!v)continue;const col=start.columnIndex+ci;if(v.formulaValue){assert.equal(col,6);s.formulas.add(i);}else s.rows[i][col]=v.numberValue??v.stringValue;}}refresh(s);}
    if(r.appendCells){const s=state.sheets.get(r.appendCells.sheetId);for(const row of r.appendCells.rows)s.rows.push(row.values.map((c:any)=>c.userEnteredValue.numberValue??c.userEnteredValue.stringValue));}
    if(r.createDeveloperMetadata){const m=r.createDeveloperMetadata.developerMetadata;state.markers.set(m.metadataKey,m);}
    if(r.deleteDeveloperMetadata)state.markers.delete(r.deleteDeveloperMetadata.dataFilter.developerMetadataLookup.metadataKey);
   }
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
 await activateStockFlow('owner');return {...state,state,addOrder};
}
test('baseline keeps physical balance, new products use independent completed totals, and malformed baseline fails closed',()=>{
 const rows=fresh(),plan=flowBaselinePlan(source(rows));assert.equal(plan.changes[0].remainingAfter,490);assert.equal(plan.changes[0].pendingAfter,0);assert.equal(plan.changes[0].completedAfter,10);
 rows[0][12]=STOCK_COMPLETED_HEADER;rows[2][12]=10;rows[2][5]=0;
 const s=source(rows),receive=stockReceiptPlan(newStockProduct.parse({requestKey:'ad83d6b7-84b5-4b42-b45f-fdf7285c80cf',code:'A2',name:'New',cost:1.5,quantity:200,prices:[]}),s);
 const added:any=(receive.requests as any[]).find(r=>r.appendCells).appendCells.rows[0].values;assert.equal(added[12].userEnteredValue.numberValue,0);assert.match(added[6].userEnteredValue.formulaValue,/M:M/);
 assert.equal(stockHistorySnapshot('2026-11-05',{...s,readAt:new Date('2026-11-06')},'owner').rows[0][5],'จำนวนรอจ่าย (G)');
 rows[2][12]='taken';assert.throws(()=>flowBaselinePlan(source(rows)));
 const wrong=fresh();wrong[2][6]=10;assert.throws(()=>flowBaselinePlan(source(wrong)),/BASELINE_INCONSISTENT/);
});
test('reserve leaves balance unchanged; history is saved first; partial shipping clears only that order; repeated submission never deducts twice',async t=>{
 const h=await harness(t);assert.equal(h.rows[2][6],490);assert.equal(h.rows[2][5],0);assert.equal(h.rows[2][12],10);
 const backup=[...h.sheets.values()].find(s=>s.title.startsWith('ก่อนเริ่มรอบ'));assert.equal(backup.rows[2][5],10);assert.equal(backup.rows[2][6],490);
 h.addOrder('o1');h.addOrder('o2',100);await queueStockOrder('o1');await queueStockOrder('o2');await syncStockReservation('o1');await syncStockReservation('o2');await syncStockReservation('o1');
 assert.equal(h.rows[2][5],300);assert.equal(h.rows[2][6],490);await assert.rejects(()=>assertNoStockReservations(['A1']),/PENDING_ORDERS/);
 assert.equal((await processStockDispatch('o1','owner')).status,'POSTED');assert.equal(h.rows[2][5],100);assert.equal(h.rows[2][6],290);assert.equal(h.rows[2][12],210);
 assert.ok(h.events.indexOf('historyDb')<h.events.indexOf('archive'));assert.ok(h.events.indexOf('archive')<h.events.indexOf('deduction'));
 assert.equal((await processStockDispatch('o1','owner')).status,'POSTED');assert.equal(h.rows[2][6],290);
 assert.equal((await processStockDispatch('o2','owner')).status,'POSTED');assert.equal(h.rows[2][5],0);assert.equal(h.rows[2][6],190);
 const archived=[...h.sheets.values()].find(s=>s.title.startsWith('จัดส่ง '));assert.equal(archived.rows.length,3);assert.equal(h.dispatches.get('o1').totalCostSatang,30000);
 h.rows[2][3]=99;await processStockDispatch('o1','owner');assert.equal(h.dispatches.get('o1').totalCostSatang,30000);
});
test('missing cost waits; history database and Sheets archive failures do not deduct; later retries retain frozen cost',async t=>{
 const h=await harness(t);h.addOrder('o1');await queueStockOrder('o1');await syncStockReservation('o1');h.rows[2][3]=null;
 assert.equal((await processStockDispatch('o1','owner')).status,'WAITING_COST');assert.equal(h.rows[2][5],200);assert.equal(h.rows[2][6],490);assert.ok(!h.events.includes('historyDb'));
 h.rows[2][3]=1.5;h.state.failHistory=true;assert.equal((await processStockDispatch('o1','owner')).status,'NEEDS_REVIEW');assert.equal(h.rows[2][6],490);
 h.state.failHistory=false;h.state.failArchive=true;assert.equal((await processStockDispatch('o1','owner')).status,'HISTORY_SAVED');assert.equal(h.rows[2][5],200);assert.equal(h.rows[2][6],490);
 h.state.failArchive=false;h.rows[2][3]=9;assert.equal((await processStockDispatch('o1','owner')).status,'POSTED');assert.equal(h.rows[2][5],0);assert.equal(h.rows[2][6],290);assert.equal(h.dispatches.get('o1').totalCostSatang,30000);
});
test('lost deduction response and final database failure recover without duplicate history, changed cost or consuming another pending order',async t=>{
 const h=await harness(t);h.addOrder('o1');h.addOrder('o2',50);await queueStockOrder('o1');await queueStockOrder('o2');await syncStockReservation('o1');await syncStockReservation('o2');
 h.state.loseDeduction=true;assert.equal((await processStockDispatch('o1','owner')).status,'HISTORY_SAVED');assert.equal(h.rows[2][5],50);assert.equal(h.rows[2][6],290);
 h.state.failFinal=true;assert.equal((await processStockDispatch('o1','owner')).status,'HISTORY_SAVED');assert.equal(h.rows[2][6],290);
 assert.equal((await processStockDispatch('o1','owner')).status,'POSTED');assert.equal(h.rows[2][5],50);assert.equal(h.events.filter(e=>e==='deduction').length,1);
 const archived=[...h.sheets.values()].find(s=>s.title.startsWith('จัดส่ง '));assert.equal(archived.rows.length,2);
 h.orders.get('o2').status='CANCELLED';await syncStockReservation('o2');assert.equal(h.rows[2][5],0);assert.equal(h.rows[2][6],290);
 h.addOrder('duplicate',20,'TRACK-o1');assert.equal((await processStockDispatch('duplicate','owner')).status,'NEEDS_REVIEW');assert.equal(h.rows[2][6],290);
});
test('unshipped cancellation releases pending only; insufficient available quantity cannot over-reserve',async t=>{
 const h=await harness(t);h.addOrder('o1',300);await queueStockOrder('o1');await syncStockReservation('o1');
 h.addOrder('o2',200);await queueStockOrder('o2');assert.equal((await syncStockReservation('o2')).status,'NEEDS_REVIEW');assert.equal(h.rows[2][5],300);
 h.orders.delete('o1');assert.equal((await syncStockReservation('o1')).status,'RELEASED');assert.equal(h.rows[2][5],0);assert.equal(h.rows[2][6],490);
 await syncStockReservation('o2');assert.equal(h.rows[2][5],200);assert.equal(h.rows[2][6],490);
 assert.throws(()=>flowDispatchPlan([{code:'A1',quantityMilliG:300000}],source(h.rows)),/PENDING_MISMATCH/);
 h.rows[2][6]=100;assert.throws(()=>flowReservationPlan([{code:'A1',quantityMilliG:1000}],source(h.rows)),/BALANCE_MISMATCH/);
});

