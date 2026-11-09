import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../src/lib/db';
import {sha} from '../src/lib/crypto';
import {createWebsiteOrder,reviewWebsiteOrder,loadWebsiteOrdersForCustomer,listWebsiteOrders} from '../src/lib/website-orders';

function fixture(t:TestContext){
 const original=db.$transaction,originalFindMany=db.websiteOrder.findMany;
 t.after(()=>{db.$transaction=original;db.websiteOrder.findMany=originalFindMany;});
 const customer:any={code:'C100',title:'คุณ',name:'Example Customer',phone:'0812345678',address:'10 Example Road Bangkok 10200',portalRegistrationPending:false,portalProfileIncomplete:false};
 const state={customer,bank:{bankName:'Example Bank',accountName:'Example Account',accountNumber:'1234567890',version:'12345678-1234-4234-8234-123456789abc'},rows:[{code:'A1',name:'General product',available:100,prices:[{pack:'10G',priceSatang:1000},{pack:'20G',priceSatang:1800}]}] as any[],orders:new Map<string,any>(),audits:[] as any[],snapshotReads:0,locks:[] as string[]};
 const tx={
  $queryRawUnsafe:async(_sql:string,key:string)=>{state.locks.push(key);return [{locked:true}];},
  customer:{findUnique:async({where}:any)=>where.code===customer.code?structuredClone(customer):null},
  employeeStockSnapshot:{findUnique:async()=>{state.snapshotReads++;return {rows:state.rows,fetchedAt:new Date('2026-11-07T02:00:00Z')};}},
  stockProductImage:{findMany:async()=>[]},
  websitePaymentSettings:{findUnique:async()=>structuredClone(state.bank)},
  websiteOrder:{
   findUnique:async({where}:any)=>{
    const match=where.id?state.orders.get(where.id):[...state.orders.values()].find(order=>order.customerCode===where.customerCode_requestKey.customerCode&&order.requestKey===where.customerCode_requestKey.requestKey);
    return match?structuredClone(match):null;
   },
   create:async({data}:any)=>{
    const order={paymentMethod:null,subtotalSatang:null,shippingSatang:0,bankDetails:null,slipVersion:null,...structuredClone(data),id:randomUUID(),status:'PENDING_REVIEW',reviewNote:'',reviewedBy:null,reviewedAt:null,createdAt:new Date(),updatedAt:new Date()};
    state.orders.set(order.id,order);
    return structuredClone(order);
   },
   updateMany:async({where,data}:any)=>{
    const order=state.orders.get(where.id);
    if(!order||order.status!==where.status)return {count:0};
    Object.assign(order,data,{updatedAt:new Date()});
    return {count:1};
   },
   findUniqueOrThrow:async({where}:any)=>structuredClone(state.orders.get(where.id)),
  },
  auditLog:{create:async({data}:any)=>{state.audits.push(structuredClone(data));}},
 };
 (db as any).$transaction=async(fn:any)=>fn(tx);
 (db.websiteOrder as any).findMany=async({where,take}:any)=>[...state.orders.values()].filter(order=>(!where.customerCode||where.customerCode===order.customerCode)&&(!where.status||where.status===order.status)).slice(0,take).map(order=>structuredClone(order));
 return state;
}
const request=(change:Record<string,unknown>={})=>({requestKey:randomUUID(),items:[{code:'A1',pack:'10G',quantity:2,expectedUnitPriceSatang:1000}],expectedTotalSatang:12000,paymentMethod:'COD',expectedShippingSatang:10000,bankVersion:null,...change});

test('website requests snapshot current catalog and delivery without creating operational orders',async t=>{
 const state=fixture(t);
 const order=await createWebsiteOrder('c100',request({items:[{code:' ａ１ ',pack:'10 กรัม',quantity:2,expectedUnitPriceSatang:1000}]}));
 assert.match(order.orderNumber,/^WEB-[A-F0-9]{20}$/);
 assert.equal(order.status,'PENDING_REVIEW');
 assert.equal(order.customerCode,'C100');
 assert.equal(order.recipient,'คุณ Example Customer');
 assert.equal(order.phone,'0812345678');
 assert.equal(order.address,state.customer.address);
 assert.equal(order.totalSatang,12000);assert.equal(order.subtotalSatang,2000);assert.equal(order.shippingSatang,10000);assert.equal(order.paymentMethod,'COD');
 assert.deepEqual(order.items,[{code:'A1',name:'General product',pack:'10G',grams:10,quantity:2,unitPriceSatang:1000,lineTotalSatang:2000}]);
 assert.equal(state.audits.length,1);
 assert.equal(state.audits[0].action,'WEBSITE_ORDER_SUBMITTED');
 assert.equal(state.rows[0].available,100);
 assert.deepEqual(state.locks,['website-order:C100']);
 assert.equal((await loadWebsiteOrdersForCustomer('c100')).length,1);
 assert.equal((await listWebsiteOrders('PENDING_REVIEW')).length,1);
 assert.equal((await listWebsiteOrders('APPROVED')).length,0);
 await assert.rejects(listWebsiteOrders('other'),/INVALID_WEBSITE_ORDER_STATUS/);
});

test('transfer requires current configured bank and a valid slip, preserves private snapshots on retries',async t=>{
 const state=fixture(t),slip='data:image/png;base64,iVBORw0KGgo=';
 const transfer=request({paymentMethod:'TRANSFER',bankVersion:state.bank.version,expectedShippingSatang:5000,expectedTotalSatang:7000,slip});
 await assert.rejects(createWebsiteOrder('C100',{...transfer,slip:undefined}),/SLIP_REQUIRED/);
 await assert.rejects(createWebsiteOrder('C100',{...transfer,slip:'data:image/png;base64,YmFk'}),/INVALID_SLIP/);
 await assert.rejects(createWebsiteOrder('C100',{...transfer,slip:'data:image/png;base64,'+'A'.repeat(3*1024*1024)}),/SLIP_TOO_LARGE/);
 await assert.rejects(createWebsiteOrder('C100',{...transfer,bankVersion:'old'}),/BANK_CHANGED/);
 await assert.rejects(createWebsiteOrder('C100',{...transfer,expectedShippingSatang:1}),/SHIPPING_CHANGED/);
 await assert.rejects(createWebsiteOrder('C100',{...request(),slip}),/INVALID_PAYMENT/);
 state.bank.bankName='';
 await assert.rejects(createWebsiteOrder('C100',transfer),/BANK_UNAVAILABLE/);
 state.bank.bankName='Example Bank';
 const saved=await createWebsiteOrder('C100',transfer);
 assert.equal(saved.totalSatang,7000);assert.equal(saved.subtotalSatang,2000);assert.equal(saved.shippingSatang,5000);
 assert.deepEqual(saved.bankDetails,state.bank);assert.match(saved.slipVersion!,/^[a-f0-9]{64}$/);
 const json=JSON.stringify(saved);
 assert.ok(!json.includes('slipData'));assert.ok(!json.includes('iVBORw0KGgo='));
 assert.ok(!JSON.stringify(state.audits).includes('iVBORw0KGgo='));
 state.bank.accountNumber='9876543210';state.bank.version=randomUUID();state.rows=[];
 assert.deepEqual(await createWebsiteOrder('C100',transfer),saved);
 await assert.rejects(createWebsiteOrder('C100',{...transfer,bankVersion:state.bank.version}),/REQUEST_CONFLICT/);
 await assert.rejects(createWebsiteOrder('C100',{...transfer,slip:'data:image/png;base64,iVBORw0KGgoA'}),/REQUEST_CONFLICT/);
});

test('legacy existing requests retain their original fingerprint while new requests require payment',async t=>{
 const state=fixture(t),modern=request();
 const legacy={requestKey:modern.requestKey,items:modern.items,expectedTotalSatang:2000};
 await assert.rejects(createWebsiteOrder('C100',legacy),/PAYMENT_REQUIRED/);
 const old={id:'legacy',orderNumber:'WEB-OLD',customerCode:'C100',requestKey:legacy.requestKey,requestFingerprint:sha(JSON.stringify({items:legacy.items,expectedTotalSatang:2000})),status:'PENDING_REVIEW',items:[],totalSatang:2000,paymentMethod:null,subtotalSatang:null,shippingSatang:0,bankDetails:null,slipVersion:null,recipient:'Existing',phone:'0812345678',address:'Legacy 10200',reviewNote:'',reviewedBy:null,reviewedAt:null,createdAt:new Date(),updatedAt:new Date()};
 state.orders.set(old.id,old);
 const replay=await createWebsiteOrder('C100',legacy);
 assert.equal(replay.id,'legacy');assert.equal(replay.subtotalSatang,2000);assert.equal(replay.paymentMethod,null);
 assert.equal(state.snapshotReads,0);assert.equal(state.audits.length,0);
 await assert.rejects(createWebsiteOrder('C100',modern),/REQUEST_CONFLICT/);
});

test('identical retries return original before catalog or delivery revalidation, while changed payload conflicts',async t=>{
 const state=fixture(t),input=request();
 const first=await createWebsiteOrder('C100',input);
 state.rows=[];
 state.customer.name='Changed';state.customer.phone='invalid';state.customer.address='invalid';
 const retry=await createWebsiteOrder('C100',input);
 assert.deepEqual(retry,first);
 assert.equal(state.snapshotReads,1);
 assert.equal(state.audits.length,1);
 await assert.rejects(createWebsiteOrder('C100',{...input,expectedTotalSatang:3000}),/REQUEST_CONFLICT/);
 await assert.rejects(createWebsiteOrder('C100',{...input,items:[{...input.items[0],quantity:3}]}),/REQUEST_CONFLICT/);
 state.customer.portalRegistrationPending=true;
 await assert.rejects(createWebsiteOrder('C100',input),/CUSTOMER_PENDING/);
 state.customer.portalRegistrationPending=false;state.customer.portalProfileIncomplete=true;
 await assert.rejects(createWebsiteOrder('C100',input),/CUSTOMER_PENDING/);
 await assert.rejects(createWebsiteOrder('C999',input),/CUSTOMER_NOT_FOUND/);
});

test('new requests reject invalid inputs, changed prices or total, and combined stock shortages',async t=>{
 const state=fixture(t);
 const invalid=[request({requestKey:'bad'}),request({items:[]}),request({items:[{code:'A1',pack:'10G',quantity:1.5,expectedUnitPriceSatang:1000}]}),request({items:[{code:'A1',pack:'10G',quantity:1000,expectedUnitPriceSatang:1000}]}),request({items:[{code:'A1',pack:'bad',quantity:1,expectedUnitPriceSatang:1000}]}),request({items:[{code:'A1',pack:'10G',quantity:1,expectedUnitPriceSatang:1000},{code:'a1',pack:'10 g',quantity:1,expectedUnitPriceSatang:1000}]})];
 for(const input of invalid)await assert.rejects(createWebsiteOrder('C100',input),/INVALID_WEBSITE_ORDER/);
 await assert.rejects(createWebsiteOrder('C100',request({items:[{code:'A1',pack:'10G',quantity:2,expectedUnitPriceSatang:999}]})),/PRICE_CHANGED/);
 await assert.rejects(createWebsiteOrder('C100',request({expectedTotalSatang:1999})),/TOTAL_CHANGED/);
 await assert.rejects(createWebsiteOrder('C100',request({items:[{code:'B1',pack:'10G',quantity:2,expectedUnitPriceSatang:1000}]})),/PRODUCT_UNAVAILABLE/);
 await assert.rejects(createWebsiteOrder('C100',request({items:[{code:'A1',pack:'30G',quantity:2,expectedUnitPriceSatang:1000}]})),/PRODUCT_UNAVAILABLE/);
 state.rows[0].available=25;
 await assert.rejects(createWebsiteOrder('C100',request({items:[{code:'A1',pack:'10G',quantity:1,expectedUnitPriceSatang:1000},{code:'A1',pack:'20G',quantity:1,expectedUnitPriceSatang:1800}],expectedTotalSatang:2800})),/STOCK_CHANGED/);
 state.rows[0].available=null;
 await assert.rejects(createWebsiteOrder('C100',request()),/STOCK_CHANGED/);
 state.rows[0].available=100;state.rows[0].prices[0].priceSatang=0;
 await assert.rejects(createWebsiteOrder('C100',request()),/PRODUCT_UNAVAILABLE/);
 state.rows[0].prices[0].priceSatang=2147483647;
 await assert.rejects(createWebsiteOrder('C100',request({items:[{code:'A1',pack:'10G',quantity:2,expectedUnitPriceSatang:2147483647}],expectedTotalSatang:2147483647})),/ORDER_TOO_LARGE/);
 state.customer.phone='invalid';
 await assert.rejects(createWebsiteOrder('C100',request()),/INVALID_DELIVERY/);
 assert.equal(state.orders.size,0);assert.equal(state.audits.length,0);
});

test('review changes only review fields once and preserves item, price and recipient snapshots',async t=>{
 const state=fixture(t),input=request();
 const original=await createWebsiteOrder('C100',input);
 const approved=await reviewWebsiteOrder('owner',{id:original.id,status:'APPROVED',note:'Checked',expectedStatus:'PENDING_REVIEW'});
 assert.equal(approved.status,'APPROVED');assert.equal(approved.reviewNote,'Checked');assert.equal(approved.reviewedBy,'owner');assert.ok(approved.reviewedAt);
 assert.deepEqual(approved.items,original.items);assert.equal(approved.recipient,original.recipient);assert.equal(approved.totalSatang,original.totalSatang);
 assert.deepEqual(await reviewWebsiteOrder('other-owner',{id:original.id,status:'APPROVED',note:'Different',expectedStatus:'PENDING_REVIEW'}),approved);
 await assert.rejects(reviewWebsiteOrder('owner',{id:original.id,status:'REJECTED',note:'',expectedStatus:'PENDING_REVIEW'}),/REVIEW_CONFLICT/);
 await assert.rejects(reviewWebsiteOrder('owner',{id:original.id,status:'APPROVED',note:'',expectedStatus:'APPROVED'}),/INVALID_WEBSITE_ORDER_REVIEW/);
 await assert.rejects(reviewWebsiteOrder('owner',{id:'missing',status:'APPROVED',note:'',expectedStatus:'PENDING_REVIEW'}),/WEBSITE_ORDER_NOT_FOUND/);
 assert.deepEqual(await createWebsiteOrder('C100',input),approved);
 assert.equal(state.rows[0].available,100);assert.equal(state.snapshotReads,1);
 assert.deepEqual(state.audits.map(row=>row.action),['WEBSITE_ORDER_SUBMITTED','WEBSITE_ORDER_REVIEWED']);
 const second=await createWebsiteOrder('C100',request());
 const rejected=await reviewWebsiteOrder('owner',{id:second.id,status:'REJECTED',note:'Unavailable',expectedStatus:'PENDING_REVIEW'});
 assert.equal(rejected.status,'REJECTED');assert.equal(rejected.reviewNote,'Unavailable');
 assert.equal((await listWebsiteOrders('REJECTED')).length,1);
});
