import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../src/lib/db';
import {createWebsiteOrder,reviewWebsiteOrder,loadWebsiteOrdersForCustomer,listWebsiteOrders,websiteOrderText,WebsiteOrderApprovalError} from '../src/lib/website-orders';
import {parseOrderText} from '../src/lib/order-parser';
import {orderStockItems} from '../src/lib/order-stock-items';
import {quotedTotal} from '../src/lib/shipment-matching';
import {pendingStockSaleItems} from '../src/lib/order-stock-admission';
process.env.USER_HASH_SECRET??='website-order-test-secret';

function fixture(t:TestContext){
 const original=db.$transaction,originalFindMany=db.websiteOrder.findMany;
 t.after(()=>{db.$transaction=original;db.websiteOrder.findMany=originalFindMany;});
 const customer:any={code:'C100',referrerId:'seller',identityKey:null,title:'คุณ',name:'Example Customer',phone:'0812345678',address:'10 Example Road Bangkok 10200',portalRegistrationPending:false,portalProfileIncomplete:false};
 const state={customer,rows:[{code:'A1',name:'General product',available:100,prices:[{pack:'10G',priceSatang:1000},{pack:'20G',priceSatang:1800}]}] as any[],orders:new Map<string,any>(),audits:[] as any[],snapshotReads:0,locks:[] as string[],reservations:[] as any[],intakes:[] as any[],sales:[] as any[],workflow:null as any};
 const tx={
  $queryRawUnsafe:async(_sql:string,key:string)=>{state.locks.push(key);return [{locked:true}];},
  customer:{findUnique:async({where}:any)=>where.code===customer.code?structuredClone(customer):null,update:async({data}:any)=>Object.assign(customer,data)},
  affiliate:{findMany:async({where}:any)=>where.OR[0].code.equals.toUpperCase()==='SELL01'?[{id:'seller',salesCommissionBasis:'REVENUE',salesCommissionBps:1000,accounts:[{username:'sell01'}]}]:[],findUnique:async()=>null},
  crmPointRule:{findFirst:async()=>null},
  stockWorkflow:{findUnique:async()=>state.workflow},
  stockReservation:{findMany:async({where}:any)=>state.reservations.filter(row=>row.status===where.status&&(!where.createdAt||row.createdAt>=where.createdAt.gte)),create:async({data}:any)=>{state.reservations.push({...data,status:'QUEUED',createdAt:new Date()});}},
  stockSheetOperation:{findMany:async()=>[]},
  orderIntake:{create:async({data}:any)=>{const row={id:'intake-'+state.intakes.length,...data};state.intakes.push(row);return row;},findMany:async({where}:any)=>state.intakes.filter(row=>where.id.in.includes(row.id))},
  salesOrder:{create:async({data}:any)=>{state.sales.push(data);return data;}},
  additionalCommission:{create:async({data}:any)=>data},
  employeeStockSnapshot:{findUnique:async()=>{state.snapshotReads++;return {rows:state.rows,fetchedAt:new Date(Date.now()-60000)};}},
  stockProductImage:{findMany:async()=>[]},
  websiteOrder:{
   findUnique:async({where}:any)=>{
    const match=where.id?state.orders.get(where.id):[...state.orders.values()].find(order=>order.customerCode===where.customerCode_requestKey.customerCode&&order.requestKey===where.customerCode_requestKey.requestKey);
    return match?structuredClone(match):null;
   },
   create:async({data}:any)=>{
    const order={...structuredClone(data),id:randomUUID(),status:'PENDING_REVIEW',reviewNote:'',reviewedBy:null,reviewedAt:null,createdAt:new Date(),updatedAt:new Date()};
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
   update:async({where,data}:any)=>Object.assign(state.orders.get(where.id),data),
   findMany:async({where}:any)=>[...state.orders.values()].filter(order=>order.status===where.status&&(!where.createdAt||order.createdAt>=where.createdAt.gte)).map(order=>structuredClone(order)),
  },
  auditLog:{create:async({data}:any)=>{state.audits.push(structuredClone(data));}},
 };
 (db as any).$transaction=async(fn:any)=>fn(tx);
 (db.websiteOrder as any).findMany=async({where,take}:any)=>[...state.orders.values()].filter(order=>(!where.customerCode||where.customerCode===order.customerCode)&&(!where.status||where.status===order.status)).slice(0,take).map(order=>structuredClone(order));
 return Object.assign(state,{tx});
}
const approval={payment:'COD',amountSatang:2500,sellerCode:'SELL01'};
const request=(change:Record<string,unknown>={})=>({requestKey:randomUUID(),items:[{code:'A1',pack:'10G',quantity:2,expectedUnitPriceSatang:1000}],expectedTotalSatang:2000,...change});

test('website requests snapshot current catalog and delivery without creating operational orders',async t=>{
 const state=fixture(t);
 const order=await createWebsiteOrder('c100',request({items:[{code:' ａ１ ',pack:'10 กรัม',quantity:2,expectedUnitPriceSatang:1000}]}));
 assert.match(order.orderNumber,/^WEB-[A-F0-9]{20}$/);
 assert.equal(order.status,'PENDING_REVIEW');
 assert.equal(order.customerCode,'C100');
 assert.equal(order.recipient,'คุณ Example Customer');
 assert.equal(order.phone,'0812345678');
 assert.equal(order.address,state.customer.address);
 assert.equal(order.totalSatang,2000);
 assert.deepEqual(order.items,[{code:'A1',name:'General product',pack:'10G',grams:10,quantity:2,unitPriceSatang:1000,lineTotalSatang:2000}]);
 assert.equal(state.audits.length,1);
 assert.equal(state.audits[0].action,'WEBSITE_ORDER_SUBMITTED');
 assert.equal(state.rows[0].available,100);
 assert.deepEqual(state.locks,['website-order:C100','stock-sheet-add']);
 assert.equal((await loadWebsiteOrdersForCustomer('c100')).length,1);
 assert.equal((await listWebsiteOrders('PENDING_REVIEW')).length,1);
 assert.equal((await listWebsiteOrders('APPROVED')).length,0);
 await assert.rejects(listWebsiteOrders('other'),/INVALID_WEBSITE_ORDER_STATUS/);
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
 const approved=await reviewWebsiteOrder('owner',{id:original.id,status:'APPROVED',note:'Checked',expectedStatus:'PENDING_REVIEW',...approval});
 assert.equal(approved.status,'APPROVED');assert.equal(approved.reviewNote,'Checked');assert.equal(approved.reviewedBy,'owner');assert.ok(approved.reviewedAt);
 assert.deepEqual(approved.items,original.items);assert.equal(approved.recipient,original.recipient);assert.equal(approved.totalSatang,original.totalSatang);
 assert.deepEqual(await reviewWebsiteOrder('other-owner',{id:original.id,status:'APPROVED',note:'Different',expectedStatus:'PENDING_REVIEW',...approval}),approved);
 await assert.rejects(reviewWebsiteOrder('owner',{id:original.id,status:'REJECTED',note:'',expectedStatus:'PENDING_REVIEW'}),/REVIEW_CONFLICT/);
 await assert.rejects(reviewWebsiteOrder('owner',{id:original.id,status:'APPROVED',note:'',expectedStatus:'APPROVED',...approval}),/INVALID_WEBSITE_ORDER_REVIEW/);
 await assert.rejects(reviewWebsiteOrder('owner',{id:'missing',status:'APPROVED',note:'',expectedStatus:'PENDING_REVIEW',...approval}),/WEBSITE_ORDER_NOT_FOUND/);
 assert.deepEqual(await createWebsiteOrder('C100',input),approved);
 assert.equal(state.rows[0].available,100);assert.equal(state.snapshotReads,1);
 assert.deepEqual(state.audits.map(row=>row.action),['WEBSITE_ORDER_SUBMITTED','WEBSITE_ORDER_REVIEWED']);
 const second=await createWebsiteOrder('C100',request());
 const rejected=await reviewWebsiteOrder('owner',{id:second.id,status:'REJECTED',note:'Unavailable',expectedStatus:'PENDING_REVIEW'});
 assert.equal(rejected.status,'REJECTED');assert.equal(rejected.reviewNote,'Unavailable');
 assert.equal((await listWebsiteOrders('REJECTED')).length,1);
});

test('approval requires payment, amount and seller, then creates one delivery order with a stock reservation',async t=>{
 const state=fixture(t);state.workflow={enabled:true,sourceSheet:'Stock'};
 const order=await createWebsiteOrder('C100',request());
 assert.deepEqual(await pendingStockSaleItems(state.tx as any),[{code:'A1',quantityMilliG:20000}]);
 for(const missing of [{payment:'เคลม'},{amountSatang:0},{sellerCode:'x'},{payment:undefined}])
  await assert.rejects(reviewWebsiteOrder('owner',{id:order.id,status:'APPROVED',note:'',expectedStatus:'PENDING_REVIEW',...approval,...missing}),/INVALID_WEBSITE_ORDER_REVIEW/);
 let reader=0;
 const stockReader=async()=>{reader++;return {tab:{title:'Stock'},products:[{code:'A1',name:'General product',costSatang:100,receivedQuantity:100,remainingQuantity:100,issuedQuantity:0,completedQuantity:0,sourceRow:2,salePrices:[]}]} as any;};
 const approved=await reviewWebsiteOrder('owner',{id:order.id,status:'APPROVED',note:'',expectedStatus:'PENDING_REVIEW',...approval},stockReader);
 assert.equal(reader,1);
 assert.equal(approved.status,'APPROVED');
 assert.equal(state.intakes.length,1);
 const intake=state.intakes[0];
 assert.equal(approved.intakeOrderId,intake.id);
 assert.equal(intake.groupKey,'website');
 assert.equal(intake.customerCode,'C100');
 assert.equal(intake.recipient,'Example Customer');
 assert.equal(intake.payment,'COD');
 assert.equal(intake.status,'WAITING_SHIPMENT');
 assert.equal(intake.sellerUsername,'sell01');
 assert.equal(quotedTotal(intake.rawText),2500);
 assert.deepEqual(state.reservations.map(row=>row.items),[[{code:'A1',quantityMilliG:20000}]]);
 // The hold moves from the website order to the delivery reservation without being counted twice.
 assert.deepEqual(await pendingStockSaleItems(state.tx as any),[{code:'A1',quantityMilliG:20000}]);
 const audit=state.audits.at(-1);
 assert.equal(audit.details.intakeOrderNumber,intake.orderNumber);
 await reviewWebsiteOrder('owner',{id:order.id,status:'APPROVED',note:'',expectedStatus:'PENDING_REVIEW',...approval},stockReader);
 assert.equal(state.intakes.length,1);
});

test('approval rolls back with reasons when live stock or delivery data cannot be admitted',async t=>{
 const state=fixture(t);state.workflow={enabled:true,sourceSheet:'Stock'};
 const order=await createWebsiteOrder('C100',request());
 const snapshot=structuredClone(state.orders.get(order.id));
 const empty=async()=>({tab:{title:'Stock'},products:[{code:'A1',name:'General product',costSatang:100,receivedQuantity:20,remainingQuantity:20,issuedQuantity:0,completedQuantity:0,sourceRow:2,salePrices:[]}]}) as any;
 // The fixture transaction does not roll back, so restore the row like the database would.
 await assert.rejects(reviewWebsiteOrder('owner',{id:order.id,status:'APPROVED',note:'',expectedStatus:'PENDING_REVIEW',...approval},empty),(error:unknown)=>error instanceof WebsiteOrderApprovalError&&/A1/.test(error.reasons[0]));
 state.orders.set(order.id,snapshot);
 state.orders.get(order.id).address='Bangkok';
 await assert.rejects(reviewWebsiteOrder('owner',{id:order.id,status:'APPROVED',note:'',expectedStatus:'PENDING_REVIEW',...approval}),(error:unknown)=>error instanceof WebsiteOrderApprovalError&&error.reasons.some(reason=>/ไปรษณีย์/.test(reason)));
 assert.equal(state.intakes.length,0);assert.equal(state.reservations.length,0);
});

test('new website orders count stock held since the last snapshot by other channels',async t=>{
 const state=fixture(t);
 state.rows[0].available=30;
 state.reservations.push({status:'QUEUED',createdAt:new Date(),items:[{code:'A1',quantityMilliG:15000}]});
 await assert.rejects(createWebsiteOrder('C100',request()),/STOCK_CHANGED/);
 state.reservations[0].createdAt=new Date(Date.now()-3600000);
 await createWebsiteOrder('C100',request());
 await assert.rejects(createWebsiteOrder('C100',request()),/STOCK_CHANGED/);
});

test('website order text round-trips through the LINE order parsers',()=>{
 const order={orderNumber:'WEB-1',customerCode:'C100',recipient:'คุณ Example Customer',phone:'0812345678',address:'10 Example Road Bangkok 10200',items:[{code:'A1',name:'X',pack:'3.5G',grams:3.5,quantity:3,unitPriceSatang:1050,lineTotalSatang:3150},{code:'B2',name:null,pack:'10G',grams:10,quantity:1,unitPriceSatang:1000,lineTotalSatang:1000}]} as any;
 const text=websiteOrderText(order,{payment:'โอน',amountSatang:4150,sellerCode:'SELL01'},'คุณ');
 const parsed=parseOrderText(text);
 assert.ok(parsed);
 assert.equal(parsed.sellerCode,'SELL01');assert.equal(parsed.customerCode,'C100');assert.equal(parsed.recipient,'Example Customer');
 assert.equal(parsed.payment,'โอน');assert.deepEqual(parsed.issues,[]);
 assert.equal(quotedTotal(text),4150);
 assert.deepEqual(orderStockItems(text),{items:[{code:'A1',quantityMilliG:10500},{code:'B2',quantityMilliG:10000}],issues:[]});
});
