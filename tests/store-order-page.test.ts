import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as runtime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import * as filters from '../src/lib/store-order-filters';
import {orderMatchesState} from '../src/lib/order-management';

async function render(input:filters.StoreOrderInput,rows:any[]){
 const exports:any={};
 const mocks:Record<string,unknown>={
  'react/jsx-runtime':runtime,
  '@/app/order-document-buttons':{OrderDocumentButtons:()=>React.createElement('div',{},'เอกสารออเดอร์')},
  'next/link':{default:({href,children,...props}:any)=>React.createElement('a',{href,...props},children)},
  '@/lib/accounts':{stockOperators:['owner','admin','store']},
  '@/lib/store-view':{requireStockPage:async()=>({role:'store'})},
  '@/lib/employee-order-dashboard':{employeeOrderDashboard:async(_input:unknown,_seller:unknown,options:any)=>{
   assert.equal(options.reviewAllRounds,true);
   return {todayRows:rows,query:input.q??'',closeTime:'12:00',counts:{ALL:rows.length,WAITING:rows.filter(row=>row.awaitingShipment).length,SHIPPED:rows.filter(row=>row.shipped).length,REVIEW:rows.filter(row=>row.state==='REVIEW').length,RETURNED:rows.filter(row=>row.state==='RETURNED').length}};
  }},
  '@/lib/order-tracking-review':{dispatchReviewReason:''},
  '@/lib/order-management':{orderMatchesState},
  '@/lib/order-duplicates':{loadDuplicateOrderReviews:async()=>new Map()},
  '@/app/duplicate-order-notice':{DuplicateOrderNotice:()=>null},
  '@/app/order-shipping-details':{OrderShippingDetails:({children}:any)=>React.createElement('div',{},children)},
  '@/lib/order-shipping-items':{loadOrderShippingItems:async(selected:any[])=>new Map(selected.map(row=>[row.id,{items:[],issues:[]}]))},
  '@/lib/store-order-filters':filters,
 };
 const code=ts.transpileModule(readFileSync('src/app/admin/store-orders/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports,require:(id:string)=>{assert.ok(id in mocks,id);return mocks[id];}});
 return renderToStaticMarkup(await exports.default({searchParams:Promise.resolve(input)}));
}
const row=(index:number,shipped=true)=>({id:'id-'+index,orderNumber:'ORDER-'+index,state:shipped?'SHIPPED':'WAITING',shipped,awaitingShipment:!shipped,createdAt:new Date('2026-10-01'),day:'2026-10-01'});

test('store shipped tab shows historical shipments and preserves filters through pagination',async()=>{
 const html=await render({status:'SHIPPED',q:'ลูกค้า',page:'2'},[...Array.from({length:30},(_,i)=>row(i)),row(99,false)]);
 assert.ok(html.includes('จัดส่งแล้ว · 30 รายการ'));
 assert.ok(html.includes('ORDER-25'));assert.ok(!html.includes('ORDER-0<'));assert.ok(!html.includes('ORDER-99'));
 assert.match(html,/name="status" value="SHIPPED"/);
 assert.ok(html.includes('status=SHIPPED&amp;q='));assert.ok(html.includes('page=2'));
 assert.ok(html.includes('หน้าก่อนหน้า'));
});

test('every store status displays its matching orders and direct detail links',async()=>{
 const rows=[row(1,false),row(2),{...row(3,false),state:'REVIEW',awaitingShipment:false},{...row(4,false),state:'RETURNED',awaitingShipment:false}];
 for(const [status,index]of [['WAITING',1],['SHIPPED',2],['REVIEW',3],['RETURNED',4]] as const){
  const html=await render({status},rows);
  assert.ok(html.includes(filters.storeOrderLabels[status]+' · 1 รายการ'));
  assert.ok(html.includes('/admin/store-orders/id-'+index+'?status='+status));
  for(const other of rows.filter(item=>item.id!=='id-'+index))assert.ok(!html.includes('>'+other.orderNumber+'</a>'));
 }
});
