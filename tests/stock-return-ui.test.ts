import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {renderToStaticMarkup} from 'react-dom/server';
import {db} from '../src/lib/db';
import {signToken} from '../src/lib/crypto';

(globalThis as any).AsyncLocalStorage??=AsyncLocalStorage;
const origin='https://stock-return.test';
const at=new Date('2026-11-06T06:00:00Z');
function replace(t:TestContext,target:any,key:string,value:any){const previous=target[key];target[key]=value;t.after(()=>{target[key]=previous;});}
function environment(t:TestContext){
 for(const [key,value] of Object.entries({APP_URL:origin,SESSION_SECRET:'stock-return-ui-test'})){
  const previous=process.env[key];process.env[key]=value;t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
 }
}
async function requestContext<T>(role:string,requestOrigin:string,run:()=>Promise<T>){
 const [{workAsyncStorage},{workUnitAsyncStorage}]=await Promise.all([import('next/dist/server/app-render/work-async-storage.external'),import('next/dist/server/app-render/work-unit-async-storage.external')]);
 const token=signToken({username:'reviewer',role,version:'v1',exp:Date.now()+60000});
 const request={type:'request',phase:'render',cookies:{get:(name:string)=>name==='admin_session'?{value:token}:undefined},headers:new Headers({origin:requestOrigin})};
 return workAsyncStorage.run({route:'/api/admin/stock/returns'} as any,()=>workUnitAsyncStorage.run(request as any,run));
}
const formRequest=(fields:Record<string,string>)=>new Request(origin+'/api/admin/stock/returns',{method:'POST',body:new URLSearchParams(fields)});

test('return actions require an authenticated stock operator and matching origin before stock work',async t=>{
 environment(t);let calls=0,role='viewer';
 replace(t,db,'$transaction',async()=>{calls++;throw Error('must not process');});
 replace(t,db.userAccount,'findUnique',async()=>({username:'reviewer',role,active:true,version:'v1'}));
 const {POST}=await import('../src/app/api/admin/stock/returns/route');
 assert.equal((await POST(formRequest({tracking:'TRACK0001',action:'retry'}))).status,403);
 assert.equal((await requestContext('viewer',origin,()=>POST(formRequest({tracking:'TRACK0001',action:'retry'})))).status,403);
 role='admin';
 assert.equal((await requestContext('admin','https://other.test',()=>POST(formRequest({tracking:'TRACK0001',action:'retry'})))).status,403);
 role='store';
 assert.equal((await requestContext('store','https://other.test',()=>POST(formRequest({tracking:'TRACK0001',action:'retry'})))).status,403);
 assert.equal(calls,0);
});

test('receipt confirmation requires the explicit full-parcel checkbox and rejects invalid actions',async t=>{
 environment(t);let calls=0;
 replace(t,db,'$transaction',async()=>{calls++;throw Error('must not process');});
 replace(t,db.userAccount,'findUnique',async()=>({username:'reviewer',role:'owner',active:true,version:'v1'}));
 const {POST}=await import('../src/app/api/admin/stock/returns/route');
 const cases:Record<string,string>[]=[
  {tracking:'TRACK0001',action:'confirm'},
  {tracking:'TRACK0001',action:'confirm',receivedAll:'on'},
  {tracking:'TRACK0001',action:'delete',receivedAll:'yes'},
  {tracking:'bad<script>',action:'retry'},
 ];
 for(const fields of cases)assert.equal((await requestContext('owner',origin,()=>POST(formRequest(fields)))).status,400);
 assert.equal(calls,0);
});

test('valid retry and checked receipt confirmation use only the fixed review redirect on failure',async t=>{
 environment(t);let confirmations=0,reads=0;
 replace(t,db,'$transaction',async()=>{confirmations++;throw Error('temporarily unavailable');});
 replace(t,db.stockReturn,'findUnique',async()=>{reads++;throw Error('temporarily unavailable');});
 replace(t,db.userAccount,'findUnique',async()=>({username:'reviewer',role:'admin',active:true,version:'v1'}));
 const {POST}=await import('../src/app/api/admin/stock/returns/route');
 const cases:Record<string,string>[]=[
  {tracking:'TRACK0001',action:'retry',returnTo:'https://other.test'},
  {tracking:'TRACK0001',action:'confirm',receivedAll:'yes',returnTo:'https://other.test'},
 ];
 for(const fields of cases){
  const response=await requestContext('admin',origin,()=>POST(formRequest(fields)));
  assert.equal(response.status,303);assert.equal(response.headers.get('location'),origin+'/admin/stock/review?returnResult=failed#stock-returns');
 }
 assert.equal(confirmations,1);assert.equal(reads,2);
});

test('return review shows exact order details, full-receipt confirmation and unknown tracking without invented links',async t=>{
 const rows=[
  {id:'r1',tracking:'TRACK0001',orderId:'order1',stage:'IN_TRANSIT',status:'NEEDS_REVIEW',reportedAt:at,issues:[],items:[]},
  {id:'r2',tracking:'UNKNOWN1',orderId:null,stage:'IN_TRANSIT',status:'NEEDS_REVIEW',reportedAt:at,issues:['ตรวจเลขพัสดุเดิม'],items:[]},
  {id:'r3',tracking:'TRACK0003',orderId:'order3',stage:'RECEIVED',status:'PENDING',reportedAt:at,issues:[],items:[{code:'CG2',quantityMilliG:500000}]}
 ];
 replace(t,db.stockReturn,'count',async()=>rows.length);replace(t,db.stockReturn,'findMany',async({where,take}:any)=>{assert.deepEqual(where.status.notIn,['POSTED','NO_STOCK_CHANGE']);assert.equal(take,25);return rows;});
 replace(t,db.auditLog,'findMany',async({where,take}:any)=>{assert.equal(where.action,'STOCK_RETURN_EMAIL_REVIEW');assert.equal(take,10);return [{id:'mail1',createdAt:at,details:{sender:'carrier@example.test',subject:'Unknown return layout',reportedAt:at.toISOString(),issues:['ไม่พบเลขพัสดุที่ยืนยันได้']}}];});
 replace(t,db.shipment,'findMany',async()=>[{tracking:'TRACK0001',orderId:'order1',recipient:'Buyer One'}]);
 replace(t,db.stockDispatch,'findMany',async()=>[{tracking:'TRACK0001',candidateTracking:'TRACK0001',orderId:'order1',orderNumber:'ORDER-1',items:[{code:'CG13',name:'Original',quantityMilliG:25000}]}]);
 replace(t,db.orderIntake,'findMany',async()=>[{id:'order1',orderNumber:'ORDER-1',recipient:'Buyer One',sellerUsername:'seller-old',sellerCode:'S1',affiliateId:'aff1',rawText:null},{id:'order3',orderNumber:'ORDER-3',recipient:'Buyer Three',sellerUsername:'seller3',affiliateId:null,rawText:null}]);
 replace(t,db.userAccount,'findMany',async()=>[{affiliateId:'aff1',username:'seller-current'}]);
 const {StockReturnStatus}=await import('../src/app/stock-return-status');
 const html=renderToStaticMarkup(await StockReturnStatus({}));
 assert.match(html,/รับสินค้าตีกลับ/);assert.match(html,/Buyer One/);assert.match(html,/seller-current/);assert.match(html,/CG13.*25 G/);
 const checkbox=html.match(/<input[^>]*name="receivedAll"[^>]*>/)?.[0];assert.ok(checkbox);assert.match(checkbox,/required=""/);assert.match(html,/ยืนยันรับคืนครบ/);assert.match(html,/ลองรับคืนอีกครั้ง/);
 assert.match(html,/ยังจับคู่เลขพัสดุนี้กับออเดอร์เดิมไม่ได้/);assert.doesNotMatch(html,/href="[^"]*UNKNOWN1/);
 assert.match(html,/href="\/admin\/orders\/order1\/review"/);
 const storeHtml=renderToStaticMarkup(await StockReturnStatus({returnPath:'/admin/stock/returns',orderBaseHref:'/admin/store-orders/',orderSuffix:''}));
 assert.match(storeHtml,/href="\/admin\/store-orders\/order1"/);
 assert.match(storeHtml,/name="returnTo" value="\/admin\/stock\/returns"/);
 assert.doesNotMatch(storeHtml,/href="\/admin\/orders\/order1\/review"/);
 assert.match(html,/อีเมลตีกลับที่ต้องตรวจรายละเอียด/);assert.match(html,/carrier@example.test/);assert.match(html,/Unknown return layout/);assert.match(html,/ไม่พบเลขพัสดุที่ยืนยันได้/);
});

test('unmatched email reviews remain visible even when no return rows exist',async t=>{
 replace(t,db.stockReturn,'count',async()=>0);replace(t,db.stockReturn,'findMany',async()=>[]);
 replace(t,db.auditLog,'findMany',async({take,orderBy}:any)=>{assert.equal(take,10);assert.deepEqual(orderBy,[{createdAt:'desc'},{id:'desc'}]);return [{id:'unmatched',createdAt:at,details:{subject:'ตรวจอีเมลนี้',reportedAt:'invalid',issues:['รูปแบบรายงานยังไม่รองรับ']}}];});
 const {StockReturnStatus}=await import('../src/app/stock-return-status');
 const html=renderToStaticMarkup(await StockReturnStatus({}));
 assert.match(html,/ไม่มีรายการตีกลับที่รอดำเนินการ/);assert.match(html,/ตรวจอีเมลนี้/);assert.match(html,/รูปแบบรายงานยังไม่รองรับ/);assert.doesNotMatch(html,/Invalid Date/);
});

test('return history uses terminal receipt dates and frozen credits, with no credit for unchanged stock',async t=>{
 const rows=[
  {id:'r1',tracking:'TRACK0001',orderId:'order1',status:'POSTED',receivedAt:at,reportedAt:at,processedAt:at,totalCostSatang:75000,historySnapshot:{orderNumber:'ORDER-1'},items:[{code:'CG2',quantityMilliG:500000,remainingBefore:-54,remainingAfter:446}]},
  {id:'r2',tracking:'UNKNOWN1',orderId:null,status:'NO_STOCK_CHANGE',receivedAt:null,reportedAt:at,processedAt:at,totalCostSatang:null,historySnapshot:null,items:[]}
 ];
 replace(t,db.stockReturn,'count',async({where}:any)=>{assert.deepEqual(where.status.in,['POSTED','NO_STOCK_CHANGE']);assert.equal(where.OR[0].receivedAt.gte.toISOString(),'2026-11-05T17:00:00.000Z');assert.equal(where.OR[1].reportedAt.lt.toISOString(),'2026-11-06T17:00:00.000Z');return rows.length;});
 replace(t,db.stockReturn,'findMany',async()=>rows);replace(t,db.stockDispatch,'findMany',async()=>[]);
 const {StockReturnHistory}=await import('../src/app/stock-return-history');
 const html=renderToStaticMarkup(await StockReturnHistory({day:'2026-11-06'}));
 assert.match(html,/ORDER-1/);assert.match(html,/CG2.*500.*G/);assert.match(html,/-54.*446/);assert.match(html,/-฿750\.00/);
 assert.match(html,/ไม่มีสต๊อกที่ต้องเพิ่มคืน/);assert.match(html,/ไม่มีรายการปรับต้นทุน/);
});


test('store staff can confirm full receipt and return only to an allowed stock page',async t=>{
 environment(t);let confirmations=0;
 replace(t,db,'$transaction',async()=>{confirmations++;throw Error('test receipt processing');});
 replace(t,db.userAccount,'findUnique',async()=>({username:'reviewer',role:'store',active:true,version:'v1'}));
 const {POST}=await import('../src/app/api/admin/stock/returns/route');
 const response=await requestContext('store',origin,()=>POST(formRequest({tracking:'TRACK0001',action:'confirm',receivedAll:'yes',returnTo:'/admin/stock/returns'})));
 assert.equal(response.status,303);
 assert.equal(response.headers.get('location'),origin+'/admin/stock/returns?returnResult=failed#stock-returns');
 assert.equal(confirmations,1);
});
