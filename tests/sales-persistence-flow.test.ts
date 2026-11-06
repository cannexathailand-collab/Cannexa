import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {db} from '../src/lib/db';
import {encryptGmail} from '../src/lib/gmail';
import {receiveOrderEvent,type OrderEvent} from '../src/lib/order-intake';
import {importGmailReports,matchShipments} from '../src/lib/gmail-reports';
import {confirmReportedShipments} from '../src/lib/shipment-report-confirmation';
import {salesReport} from '../src/lib/sales-report';
import {processStockReturn} from '../src/lib/stock-return';
import {STOCK_RETURN_SENDER} from '../src/lib/stock-return-email';

function replace(t:TestContext,target:any,key:string,value:any){const old=target[key];target[key]=value;t.after(()=>{target[key]=old;});}
const clone=<T>(value:T):T=>structuredClone(value);
function matches(row:any,where:any):boolean{
 if(!where)return true;
 return Object.entries(where).every(([key,wanted]:[string,any])=>{
  if(key==='OR')return wanted.some((part:any)=>matches(row,part));
  if(key==='AND')return wanted.every((part:any)=>matches(row,part));
  const actual=row[key];
  if(wanted===null||typeof wanted!=='object'||wanted instanceof Date)return actual===wanted||wanted instanceof Date&&+actual===+wanted;
  return Object.entries(wanted).every(([op,value]:[string,any])=>{
   if(op==='mode')return true;
   if(op==='equals')return wanted.mode==='insensitive'?String(actual).toLowerCase()===String(value).toLowerCase():actual===value;
   if(op==='in')return value.includes(actual);
   if(op==='notIn')return !value.includes(actual);
   if(op==='not')return actual!==value;
   if(op==='gte')return actual>=value;
   if(op==='some')return actual.some((entry:any)=>matches(entry,value));
   throw Error('Unhandled isolated query operator: '+op);
  });
 });
}

// Application entry points remain real. Only the database and Gmail boundary
// are isolated; every read returns a fresh copy rather than a shared fixture.
function isolatedPersistence(t:TestContext){
 const stores=new Map<string,Map<string,any>>(),creates=new Map<string,number>();
 for(const [name,model]of Object.entries(db as any))if(model&&typeof (model as any).findMany==='function'){
  for(const method of ['findUnique','findUniqueOrThrow','findFirst','findMany','create','createMany','update','updateMany','upsert','delete','deleteMany','count','aggregate','groupBy'])if(typeof (model as any)[method]==='function')replace(t,model,method,async()=>{assert.fail('Unexpected database call: '+name+'.'+method);});
 }
 let transactions:Promise<unknown>=Promise.resolve();
 replace(t,db,'$transaction',(fn:any)=>{const result=transactions.then(()=>fn(db));transactions=result.then(()=>undefined,()=>undefined);return result;});
 replace(t,db,'$queryRawUnsafe',async(query:string)=>{assert.match(query,/pg_advisory_xact_lock/);return [];});
 for(const method of ['$queryRaw','$executeRaw','$executeRawUnsafe'])replace(t,db,method,async()=>{assert.fail('Unexpected raw database query');});
 function model(name:string,defaults:any={},unique:string[][]=[['id']]){
  const rows=new Map<string,any>();stores.set(name,rows);const target=(db as any)[name];
  const found=(where:any)=>[...rows.values()].find(row=>matches(row,where));
  const create=(data:any)=>{
   for(const fields of unique)if(fields.every(key=>data[key]!==undefined&&data[key]!==null))assert.ok(![...rows.values()].some(row=>fields.every(key=>row[key]===data[key])),'Duplicate persisted '+name+': '+fields.join(','));
   const row={id:name+'-'+(rows.size+1),createdAt:new Date(),updatedAt:new Date(),...clone(defaults),...clone(data)};rows.set(row.id,row);creates.set(name,(creates.get(name)??0)+1);return clone(row);
  };
  const update=(where:any,data:any)=>{const row=found(where);assert.ok(row,'Missing '+name+' row');Object.assign(row,clone(data),{updatedAt:new Date()});return clone(row);};
  replace(t,target,'findUnique',async({where}:any)=>clone(found(where)??null));
  replace(t,target,'findFirst',async({where}:any)=>clone(found(where)??null));
  replace(t,target,'findUniqueOrThrow',async({where}:any)=>{const row=found(where);assert.ok(row,'Missing '+name+' row');return clone(row);});
  replace(t,target,'findMany',async({where,take}:any={})=>clone([...rows.values()].filter(row=>matches(row,where)).slice(0,take)));
  replace(t,target,'create',async({data}:any)=>create(data));
  replace(t,target,'update',async({where,data}:any)=>update(where,data));
  replace(t,target,'updateMany',async({where,data}:any)=>{const found=[...rows.values()].filter(row=>matches(row,where));for(const row of found)Object.assign(row,clone(data),{updatedAt:new Date()});return {count:found.length};});
  replace(t,target,'upsert',async({where,create:data,update:changes}:any)=>found(where)?update(where,changes):create(data));
  return {rows,seed:(data:any)=>{const row={id:name+'-'+(rows.size+1),...clone(defaults),...clone(data)};rows.set(row.id,row);return clone(row);}};
 }
 return {model,stores,creates};
}

async function workbook(kind:'SHIPMENT'|'COD',parcels:{tracking:string;recipient:string;phone:string;address:string;amount:number}[]){
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Report');
 sheet.addRow(kind==='SHIPMENT'?['Tracking No.','Consignee','Phone number','Address','COD Amount']:['Tracking No.','recipientName','Total Amount']);
 for(const parcel of parcels)sheet.addRow(kind==='SHIPMENT'?[parcel.tracking,parcel.recipient,parcel.phone,parcel.address,parcel.amount]:[parcel.tracking,parcel.recipient,parcel.amount]);
 return Buffer.from(await book.xlsx.writeBuffer()).toString('base64url');
}

test('LINE and Gmail flow persists sales once, rereads exact revenue, and preserves original records after a received return',async t=>{
 const h=isolatedPersistence(t),at=Date.now(),day=86400000,shipmentAt=new Date(at-day),receiptAt=new Date(at-3600000),returnAt=new Date(at-1000);
 const env={SESSION_SECRET:process.env.SESSION_SECRET,USER_HASH_SECRET:process.env.USER_HASH_SECRET};process.env.SESSION_SECRET='isolated-sales-flow';process.env.USER_HASH_SECRET='isolated-sales-flow';t.after(()=>{for(const [key,value]of Object.entries(env))if(value===undefined)delete process.env[key];else process.env[key]=value;});
 h.model('orderGroup',{enabled:true,purpose:'ORDER'},[['id']]);h.model('orderMessageWithdrawal',{},[['messageKey']]);
 h.model('affiliate').seed({id:'seller',name:'Test seller',code:'ADM001',active:true,archivedAt:null,salesCommissionBasis:'REVENUE',salesCommissionBps:1000,accounts:[{username:'adm001',role:'employee',active:true}]});
 h.model('orderIntake',{},[['id'],['messageKey'],['eventKey']]);h.model('salesOrder',{tracking:null,recognizedAt:null,paidAt:null,paidAmountSatang:null},[['id'],['orderId'],['tracking']]);
 h.model('shipment',{orderId:null,status:'WAITING_ORDER',fulfillmentStatus:'UNCONFIRMED',dispatchedAt:null,dispatchEvidence:null},[['tracking'],['orderId']]);h.model('codReceipt',{},[['tracking']]);
 h.model('gmailImport',{},[['id'],['messageId','filename']]);h.model('auditLog');h.model('stockReservation');h.model('stockDispatch');h.model('stockSheetOperation');h.model('stockReturnReport');
 h.model('stockReturn',{receivedAt:null,items:[],evidence:[],issues:[],historySavedAt:null,historySnapshot:null},[['tracking'],['orderId']]);
 h.model('stockWorkflow').seed({id:'active',enabled:true,activeFrom:new Date(at-10*day),sourceSheet:'6.11.69'});
 h.model('stockIntegrationConfig').seed({id:'active',enabled:true,activeFrom:new Date(at-10*day)});
 h.model('gmailConnection').seed({id:'active',email:'test@example.com',revision:'isolated',encryptedConfig:encryptGmail({clientId:'test.apps.googleusercontent.com',clientSecret:'secret'}),encryptedToken:encryptGmail({refreshToken:'refresh'}),syncPageToken:null});
 const cod={tracking:'EF123456789TH',recipient:'ลูกค้า COD',phone:'0812345678',address:'123 ถนนทดสอบ 10100',amount:2560},transfer={tracking:'EA123456789TH',recipient:'ลูกค้า โอน',phone:'0898765432',address:'456 ถนนตัวอย่าง 10200',amount:1000};
 const event=(id:string,payment:string,parcel:typeof cod):OrderEvent=>({webhookEventId:'event-'+id,type:'message',timestamp:at-2*day,source:{type:'group',groupId:'sales-group',userId:'seller-user'},message:{type:'text',id,text:'รหัสผู้ขาย: ADM001\nผู้รับ: '+parcel.recipient+'\nโทร: '+parcel.phone+'\nที่อยู่: '+parcel.address+'\nชำระเงิน: '+payment+'\nรายการสินค้า\nA1 x 10 G\nยอดรวม: '+parcel.amount}});
 const codEvent=event('cod','COD',cod),transferEvent=event('transfer','โอน',transfer);
 const concurrentOrders=await Promise.all([receiveOrderEvent('test-bot',codEvent),receiveOrderEvent('test-bot',codEvent),receiveOrderEvent('test-bot',{...codEvent,webhookEventId:'concurrent-redelivery'})]);
 const codOrder=concurrentOrders.find(Boolean),transferOrder=await receiveOrderEvent('test-bot',transferEvent);assert.ok(codOrder);assert.ok(transferOrder);assert.equal(concurrentOrders.filter(Boolean).length,1);
 await receiveOrderEvent('test-bot',codEvent);await receiveOrderEvent('test-bot',{...transferEvent,webhookEventId:'redelivered-transfer'});
 assert.equal(h.creates.get('orderIntake'),2);assert.equal(h.creates.get('salesOrder'),1);
 // Transfer is stored at intake, but reporting must wait for actual dispatch.
 const range={from:new Date(at-3*day).toISOString().slice(0,10),to:new Date(at+day).toISOString().slice(0,10)};
 assert.equal((await salesReport(range)).summary.revenueSatang,0);
 const shipmentData=await workbook('SHIPMENT',[cod,{...transfer,amount:0}]),codData=await workbook('COD',[cod]);
 const headers=['ลำดับ','เลขพัสดุ','ชื่อ - นามสกุลผู้รับ','COD Amount (บาท)','สถานะ (ตามหน้าเว็บปณ. )','เหตุผลของปลายทาง','หมายเหตุของปลายทาง'];
 const returnHtml='<table><tr>'+headers.map(v=>'<th>'+v+'</th>').join('')+'</tr><tr>'+['1',cod.tracking,cod.recipient,'2560','ส่งคืนถึงผู้ส่งแล้ว','',''].map(v=>'<td>'+v+'</td>').join('')+'</tr></table>';
 const messages=new Map<string,any>();
 for(const [id,kind,data,date]of [['shipment','SHIPMENT',shipmentData,shipmentAt],['shipment-repeat','SHIPMENT',shipmentData,shipmentAt],['cod','COD',codData,receiptAt],['cod-repeat','COD',codData,receiptAt]]as const)messages.set(id,{sender:kind==='SHIPMENT'?'account-thaipost-freight@myorder.ai':'account-thaipost-cod@myorder.ai',subject:kind+' report',internalDate:String(+date),parts:[{filename:kind+'.xlsx',body:{data}}]});
 messages.set('return',{sender:STOCK_RETURN_SENDER,subject:'แจ้งพัสดุถูกตีกลับ 1 รายการ',internalDate:String(+returnAt),mimeType:'text/html',body:{data:Buffer.from(returnHtml).toString('base64url')}});
 replace(t,globalThis,'fetch',async(input:any)=>{
  const url=new URL(String(input));if(url.hostname==='oauth2.googleapis.com')return Response.json({access_token:'isolated-token'});
  assert.equal(url.hostname,'gmail.googleapis.com','No live Sheets or other external writes are permitted');
  const id=decodeURIComponent(url.pathname.split('/messages/')[1]??''),message=messages.get(id);assert.ok(message,'Unknown isolated Gmail message');
  const payload={headers:[{name:'From',value:message.sender},{name:'Subject',value:message.subject}],parts:message.parts,mimeType:message.mimeType,body:message.body};return Response.json({internalDate:message.internalDate,payload});
 });
 await Promise.all([importGmailReports('test',['shipment']),importGmailReports('test',['shipment'])]);
 assert.equal((await db.gmailImport.findMany()).length,1);assert.equal((await db.shipment.findMany()).length,2);await matchShipments('test');
 assert.equal((await confirmReportedShipments('test')).confirmed,2);
 let persistedCod=await db.salesOrder.findUnique({where:{orderId:codOrder.id}});assert.ok(persistedCod);assert.equal(persistedCod.status,'WAITING_COD');assert.equal(persistedCod.recognizedAt,null);
 assert.equal((await salesReport(range)).summary.revenueSatang,100000);
 await Promise.all([importGmailReports('test',['cod']),importGmailReports('test',['cod'])]);assert.equal((await db.codReceipt.findMany()).length,1);await matchShipments('test');
 persistedCod=await db.salesOrder.findUnique({where:{orderId:codOrder.id}});assert.ok(persistedCod);assert.equal(persistedCod.revenueSatang,256000);assert.equal(+persistedCod.recognizedAt!,+shipmentAt);assert.equal(persistedCod.commissionSatang,25600);
 let report=await salesReport(range);assert.equal(report.summary.count,2);assert.equal(report.summary.revenueSatang,356000);assert.equal(h.creates.get('salesOrder'),2);
 const persistedIds=(await db.salesOrder.findMany()).map(s=>s.id).sort(),recognitionAudits=(await db.auditLog.findMany()).filter(a=>a.action==='SALES_RECOGNITION_CHANGED');assert.equal(recognitionAudits.length,2);
 assert.equal((await importGmailReports('test',['shipment','cod'])).imported,0);
 assert.equal((await importGmailReports('test',['shipment-repeat','cod-repeat'])).imported,2);await matchShipments('test');assert.equal((await confirmReportedShipments('test')).confirmed,0);
 report=await salesReport(range);assert.equal(report.summary.revenueSatang,356000);assert.equal(report.summary.count,2);assert.equal(h.creates.get('salesOrder'),2);assert.deepEqual((await db.salesOrder.findMany()).map(s=>s.id).sort(),persistedIds);
 assert.equal((await db.shipment.findMany()).length,2);assert.equal((await db.codReceipt.findMany()).length,1);assert.equal((await db.auditLog.findMany()).filter(a=>a.action==='SALES_RECOGNITION_CHANGED').length,2);
 // A completed receipt can reverse revenue even when this isolated scenario has
 // no original stock deduction: it must not invent a stock or cost credit.
 await db.salesOrder.update({where:{orderId:codOrder.id},data:{status:'PAID',paidAt:receiptAt,paidAmountSatang:25600}});
 const originalImports=clone(await db.gmailImport.findMany()),originalCodReceipt=clone(await db.codReceipt.findUnique({where:{tracking:cod.tracking}}));
 assert.equal((await importGmailReports('test',['return'])).imported,1);assert.equal((await processStockReturn(cod.tracking,'test')).status,'NO_STOCK_CHANGE');
 report=await salesReport(range);assert.equal(report.summary.count,1);assert.equal(report.summary.revenueSatang,100000);
 const returned=await db.salesOrder.findUnique({where:{orderId:codOrder.id}});assert.ok(returned);assert.equal(returned.id,persistedCod.id);assert.equal(returned.revenueSatang,256000);assert.equal(returned.recognizedAt,null);assert.equal(returned.status,'PAID');assert.equal(returned.paidAmountSatang,25600);
 assert.deepEqual(await db.gmailImport.findMany(),originalImports);assert.deepEqual(await db.codReceipt.findUnique({where:{tracking:cod.tracking}}),originalCodReceipt);assert.deepEqual((await db.salesOrder.findMany()).map(s=>s.id).sort(),persistedIds);
 assert.equal((await importGmailReports('test',['return','shipment','cod'])).imported,0);await matchShipments('test');await confirmReportedShipments('test');assert.equal((await processStockReturn(cod.tracking,'test')).status,'NO_STOCK_CHANGE');
 assert.equal((await salesReport(range)).summary.revenueSatang,100000);assert.equal((await db.auditLog.findMany()).filter(a=>a.action==='SALES_RECOGNITION_REVERSED').length,1);assert.equal(h.creates.get('salesOrder'),2);
 assert.equal((await db.stockReturn.findUnique({where:{tracking:cod.tracking}}))?.totalCostSatang,0);assert.equal(h.stores.get('stockSheetOperation')?.size,0);
});
