import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as runtime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {OrderShippingDetails} from '../src/app/order-shipping-details';
import {PopupDetails} from '../src/app/popup-details';

test('website order card renders full shipping details and compact review controls without live orders',async()=>{
 let authenticated=false;
 const row={id:'web-order',orderNumber:'WEB-123',customerCode:'customer-1',status:'PENDING_REVIEW',createdAt:'2026-11-10T03:00:00Z',recipient:'Recipient',phone:'0812345678',address:'Complete address',paymentMethod:'COD',totalSatang:49000,subtotalSatang:45000,shippingSatang:4000,items:[{code:'CG1',name:'Product',grams:20,pack:'20G',quantity:1,unitPriceSatang:45000,lineTotalSatang:45000}]};
 const mocks:Record<string,unknown>={
  'react/jsx-runtime':runtime,
  'next/link':{default:({children,href,...props}:any)=>React.createElement('a',{href,...props},children)},
  '@/app/popup-details':{PopupDetails},'@/app/order-shipping-details':{OrderShippingDetails},
  '@/lib/order-team':{loadOrderTeamNames:async()=>new Map()},
  '@/lib/auth':{requireAdminPage:async()=>{authenticated=true;}},
  '@/lib/customer-code':{displayCustomerCode:(value:string)=>value},
  '@/lib/db':{db:{customer:{findMany:async()=>[]}}},
  '@/lib/meta-ad':{metaAdCode:'META'},
  '@/lib/website-orders':{listWebsiteOrders:async()=>[row]},
  '@/lib/website-order-status':{websiteOrderStatusLabels:{PENDING_REVIEW:'รอตรวจสอบ'}},
  './review-controls':{WebsiteOrderReviewControls:()=>React.createElement('p',{},'Review form')},
 };
 const exports:any={};
 const source=ts.transpileModule(readFileSync('src/app/admin/orders/website/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{exports,require:(name:string)=>{assert.ok(name in mocks,name);return mocks[name];},Date,Object,Map,Set});
 const html=renderToStaticMarkup(await exports.default({searchParams:Promise.resolve({status:'ALL'})}));
 assert.ok(authenticated);
 for(const value of ['employee-order-card','WEB-123','Recipient','0812345678','Complete address','CG1','Product','490.00 บาท','เก็บเงินปลายทาง (COD)','คัดลอกรายละเอียดออเดอร์','ตรวจสอบและรับออเดอร์','ราคาสินค้า'])assert.ok(html.includes(value),value);
 assert.match(html,/<dialog[^>]*>[\s\S]*Review form/);
});
