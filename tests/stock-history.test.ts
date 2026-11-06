import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stockClosingDay,stockHistorySnapshot,stockHistoryRequests,stockHistoryValuesMatch,stockHistoryDate} from '../src/lib/stock-history-plan';
import {latestStockTab} from '../src/lib/stock-product-input';
import {stockRows} from '../src/lib/stock-import';
import {db} from '../src/lib/db';
import {prepareStockDailyClose,exportStockDailySnapshot} from '../src/lib/stock-history';
import {bangkokDay,shiftDay} from '../src/lib/sales-dates';
import {GET} from '../src/app/api/cron/stock-history/route';
import {generateKeyPairSync} from 'node:crypto';
import {appendStockProduct} from '../src/lib/stock-google';
import {newStockProduct} from '../src/lib/stock-product-input';
import {encryptGmail} from '../src/lib/gmail';

const sourceRows=():unknown[][]=>[
 [null,null,'รายการ',null,'จำนวนรับ','จำนวนจ่าย','จำนวนคงเหลือ'],
 [null,null,null,null,null,null,null,null,'10G','50G','100G','1 KG'],
 [null,null,'A1',null,200,210,-10,'receipt-secret',300,'20G/500',800,4000],
 [null,'Example','B1',0,null,null,null,null,0]
];
const source=()=>{const rows=sourceRows();return {rows,products:stockRows(rows,{costColumnConfirmed:true}),tab:{sheetId:5,title:'5.11.69'},readAt:new Date('2026-11-06T17:03:00Z')};};
test('daily closing uses Thai midnight, never invents pre-activation days, and archive tabs are never operational stock',()=>{
 assert.equal(stockClosingDay('2026-11-06',new Date('2026-11-06T16:59:59Z')),null);
 assert.equal(stockClosingDay('2026-11-06',new Date('2026-11-06T17:00:00Z')),'2026-11-06');
 assert.equal(stockClosingDay('2026-10-31',new Date('2026-10-31T17:00:00Z')),'2026-10-31');
 assert.equal(stockHistoryDate('2026-02-30','2026-11-06'),'2026-11-06');
 assert.equal(latestStockTab([{sheetId:5,title:'5.11.69'},{sheetId:6,title:'ปิดยอด 2026-11-06'}]).sheetId,5);
 assert.throws(()=>stockHistorySnapshot('2026-11-07',source(),'owner'),/DAY_NOT_FINISHED/);
});
test('daily snapshot freezes names/costs/pack prices/negative or unknown quantities and never writes live rows or formulas',()=>{
 const live=source(),snapshot=stockHistorySnapshot('2026-11-06',live,'owner',77);
 live.rows[2][8]=999;live.products[0].salePrices[0].priceSatang=99900;live.products.splice(0,1);
 assert.equal(snapshot.products.length,2);
 assert.equal(snapshot.products[0].salePrices[0].priceSatang,30000);
 assert.equal(snapshot.products[0].remainingQuantity,-10);
 assert.equal(snapshot.products[0].costSatang,null);
 assert.equal(snapshot.products[1].costSatang,0);
 assert.equal(snapshot.products[1].remainingQuantity,null);
 assert.equal(snapshot.rows[2][8],300);
 assert.equal(snapshot.rows[2][9],'20G/500');
 assert.equal(snapshot.rows[2][7],'');
 const requests=stockHistoryRequests(snapshot) as any[];
 assert.equal(requests[0].addSheet.properties.sheetId,77);
 assert.equal(requests[1].updateCells.start.sheetId,77);
 assert.ok(!JSON.stringify(requests).includes('formulaValue'));
 assert.ok(!JSON.stringify(requests).includes('receipt-secret'));
 assert.ok(requests.every(r=>Object.keys(r).length===1));
 const empty=stockHistoryRequests(stockHistorySnapshot('2026-11-06',{...source(),products:[]},'owner',88)) as any[];
 assert.ok(empty.every(r=>!r.repeatCell?.range||r.repeatCell.range.endRowIndex>r.repeatCell.range.startRowIndex));
});
test('captured history survives a lost Sheets response; retry exports original values and only one tab/audit even after current stock changes',async t=>{
 const now=new Date(),day=shiftDay(bangkokDay(now),-1),rows=sourceRows();let saved:any=null,archive:any=null,writes=0,audits=0,creates=0,lose=true;
 replaceMethod(t,db.stockHistoryConfig,'findUnique',async()=>({enabled:true,startDay:day}));
 replaceMethod(t,db.stockDailySnapshot,'findUnique',async()=>saved);
 replaceMethod(t,db.stockDailySnapshot,'create',async({data}:any)=>{creates++;saved={...data,status:'PENDING',exportedAt:null};return saved;});
 replaceMethod(t,db,'$transaction',async(fn:any)=>fn({stockDailySnapshot:{update:async({data}:any)=>Object.assign(saved,data)},auditLog:{upsert:async()=>{audits++;}}}));
 const client=async(path:string,init?:RequestInit):Promise<any>=>{
  if(path.startsWith('?'))return {sheets:[{properties:{sheetId:5,title:'5.11.69',gridProperties:{rowCount:20}}},...(archive?[archive]:[])]};
  if(path===':batchUpdate'){
   writes++;const requests=JSON.parse(String(init?.body)).requests,properties=requests.find((r:any)=>r.addSheet).addSheet.properties;
   const values=requests.find((r:any)=>r.updateCells).updateCells.rows.map((r:any)=>r.values.map((c:any)=>c.userEnteredValue?.numberValue??c.userEnteredValue?.stringValue??''));
   archive={properties,values,developerMetadata:[requests.find((r:any)=>r.createDeveloperMetadata).createDeveloperMetadata.developerMetadata]};
   if(lose){lose=false;throw Error('Lost response');}return {};
  }
  return {values:decodeURIComponent(path).includes('ปิดยอด')?archive.values:rows};
 };
 const first=await prepareStockDailyClose(client,'owner',now);assert.ok(first);assert.equal(creates,1);
 await assert.rejects(()=>exportStockDailySnapshot(client,first),/Lost response/);
 assert.equal(saved.status,'PENDING');assert.equal(writes,1);
 rows[2][4]=500;rows[2][8]=999;
 const retried=await prepareStockDailyClose(client,'owner',now);assert.equal(retried?.products,saved.products);assert.equal(creates,1);
 const done=await exportStockDailySnapshot(client,retried);assert.equal(done?.status,'COMPLETE');
 await exportStockDailySnapshot(client,done);
 assert.equal(writes,1);assert.equal(audits,1);assert.equal(saved.products[0].receivedQuantity,200);assert.equal(archive.values[2][8],300);
 assert.equal(stockHistoryValuesMatch(saved.rows,archive.values),true);
 archive.values[2][8]=999;assert.equal(stockHistoryValuesMatch(saved.rows,archive.values),false);
});
test('a same-name foreign archive is never overwritten',async()=>{
 const snapshot={...stockHistorySnapshot('2026-11-06',source(),'owner',77),status:'PENDING',exportedAt:null,createdAt:new Date()};
 let writes=0;
 await assert.rejects(()=>exportStockDailySnapshot(async(path)=>{if(!path.startsWith('?'))writes++;return {sheets:[{properties:{sheetId:66,title:snapshot.sheetTitle}}]};},snapshot),/HISTORY_CONFLICT/);
 assert.equal(writes,0);
});
test('history cron rejects missing/incorrect authorization before reading stock',async t=>{
 const before=process.env.CRON_SECRET;t.after(()=>{if(before===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=before;});
 let calls=0;replaceMethod(t,db,'$transaction',async()=>{calls++;});
 delete process.env.CRON_SECRET;assert.equal((await GET(new Request('https://test/api/cron/stock-history'))).status,503);
 process.env.CRON_SECRET='history-secret-at-least-32-characters';
 assert.equal((await GET(new Request('https://test/api/cron/stock-history'))).status,403);
 assert.equal(calls,0);
});

test('first stock receipt after a Thai day boundary preserves closing quantities before the write, even when receipt response is lost',async t=>{
 const secret=process.env.SESSION_SECRET;process.env.SESSION_SECRET='history-integration-test';
 t.after(()=>{if(secret===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=secret;});
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const config={type:'service_account',client_email:'test@example.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})};
 replaceMethod(t,db.stockSheetsConnection,'findUnique',async()=>({encryptedConfig:encryptGmail(config),revision:'history-receipt-test'}));
 replaceMethod(t,db.stockHistoryConfig,'findUnique',async()=>({enabled:true,startDay:shiftDay(bangkokDay(new Date()),-1)}));
 let saved:any=null;const operations:string[]=[];
 replaceMethod(t,db.stockDailySnapshot,'findUnique',async()=>saved);
 replaceMethod(t,db.stockDailySnapshot,'create',async({data}:any)=>{operations.push('freeze');saved={...data,status:'PENDING'};return saved;});
 replaceMethod(t,db,'$transaction',async(fn:any)=>fn({$queryRawUnsafe:async()=>[{locked:true}],auditLog:{upsert:async()=>{}}}));
 const rows=sourceRows();rows[2][5]=10;rows[2][6]=190;
 replaceMethod(t,globalThis,'fetch',async(url:any,init:any)=>{
  const u=String(url);
  if(u.includes('oauth2.googleapis.com'))return Response.json({access_token:'fake',expires_in:3600});
  if(u.endsWith('/developerMetadata:search'))return Response.json({matchedDeveloperMetadata:[]});
  if(u.endsWith(':batchUpdate')){
   operations.push('receive');
   for(const request of JSON.parse(init.body).requests)if(request.updateCells){const c=request.updateCells;rows[c.start.rowIndex][c.start.columnIndex]=c.rows[0].values[0].userEnteredValue.numberValue;}
   throw Error('Lost receipt response');
  }
  if(u.includes('valueRenderOption=FORMULA'))return Response.json({values:[[rows[2][6]]]});
  if(u.includes('/values/'))return Response.json({values:rows});
  return Response.json({sheets:[{properties:{sheetId:5,title:'5.11.69',gridProperties:{rowCount:20}}}]});
 });
 const input=newStockProduct.parse({requestKey:'ad83d6b7-84b5-4b42-b45f-fdf7285c80cf',code:'A1',name:'',cost:null,quantity:5,prices:[]});
 await assert.rejects(()=>appendStockProduct(input,'owner'),/Lost receipt response/);
 assert.deepEqual(operations,['freeze','receive']);
 assert.equal(saved.products[0].receivedQuantity,200);assert.equal(saved.products[0].remainingQuantity,190);
 assert.equal(rows[2][4],205);assert.equal(rows[2][6],195);
});
function replaceMethod(t:any,target:any,key:string,fn:any){const original=target[key];target[key]=fn;t.after(()=>{target[key]=original;});}
