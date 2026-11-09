import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {summarizeCustomerOrders} from '../src/lib/customer-crm';
import {buildCustomerDashboard} from '../src/lib/customer-dashboard';
import {CustomerDashboard} from '../src/app/customer-dashboard';

type Row=ReturnType<typeof summarizeCustomerOrders>['allHistory'][number];
const row=(id:string,date:string,payment='โอน',recognized=true,amount=10000,profit:number|null=2000,status='TRANSFER_RECORDED')=>({order:{id,eventAt:new Date(date+'T12:00:00+07:00'),rawText:'สินค้า: CG1 20 G',payment,status,withdrawnAt:null},recognized,excluded:['RETURNED','CANCELLED'].includes(status)||payment==='เคลม',returned:status==='RETURNED',shipped:recognized||status==='RETURNED',amountSatang:amount,profitSatang:profit}) as Row;
const now=new Date('2026-11-10T12:00:00+07:00');
test('customer dashboard compares equal periods and keeps statuses and payment totals distinct',()=>{
 const current=row('current','2026-11-01'),previous=row('previous','2026-09-20','COD',true,5000,1000);
 const data=buildCustomerDashboard([current,current,previous,row('pending','2026-11-02','COD',false,2000,null),row('returned','2026-11-03','COD',false,3000,null,'RETURNED'),row('cancelled','2026-11-04','โอน',false,0,null,'CANCELLED'),row('claim','2026-11-05','เคลม',false)],undefined,now);
 assert.deepEqual(data.currentRange,{from:'2026-10-12',to:'2026-11-10'});assert.deepEqual(data.previousRange,{from:'2026-09-12',to:'2026-10-11'});
 assert.equal(data.current.revenueSatang,10000);assert.equal(data.previous.revenueSatang,5000);assert.equal(data.current.profitMargin,20);
 assert.equal(data.totalOrders,6);assert.equal(data.statuses.reduce((sum,item)=>sum+item.count,0),6);
 assert.equal(data.payments[1].amountSatang,7000);assert.equal(data.products[0].orders,2);assert.equal(data.products[0].quantityMilliG,40000);
});
test('missing costs stay unknown and empty charts remain valid',()=>{
 const incomplete=buildCustomerDashboard([row('missing','2026-11-01','โอน',true,10000,null)],undefined,now);
 assert.equal(incomplete.current.profitSatang,null);assert.equal(incomplete.current.profitMargin,null);assert.equal(incomplete.current.missingCosts,1);
 const empty=buildCustomerDashboard([],undefined,now);const html=renderToStaticMarkup(createElement(CustomerDashboard,{data:empty}));
 assert.equal(empty.totalOrders,0);assert.doesNotMatch(html,/NaN|Infinity/);assert.match(html,/เปรียบเทียบผลการซื้อ/);assert.match(html,/สถานะออเดอร์ทั้งหมด/);assert.match(html,/สินค้าที่ซื้อบ่อย/);
});

test('customer dashboard shows the product name with its code',()=>{
 const data=buildCustomerDashboard([row('named','2026-11-01')],undefined,now);
 const html=renderToStaticMarkup(createElement(CustomerDashboard,{data,productNames:new Map([['CG1','Product name']])}));
 assert.match(html,/Product name/);assert.match(html,/CG1/);
});

test('missing product names use a dash and retain the product code',()=>{
 const data=buildCustomerDashboard([row('unnamed','2026-11-01')],undefined,now);
 const html=renderToStaticMarkup(createElement(CustomerDashboard,{data,productNames:new Map([['CG1','  ']])}));
 assert.match(html,/<strong>—<\/strong>/);assert.match(html,/CG1/);
});

test('comparison shows percentage changes alongside amounts and percentage points',()=>{
 const data=buildCustomerDashboard([row('current','2026-11-01','โอน',true,15000,4500),row('previous','2026-09-20','โอน',true,10000,2000)],undefined,now);
 const html=renderToStaticMarkup(createElement(CustomerDashboard,{data}));
 assert.match(html,/\+50\.0%/);
 assert.match(html,/\+125\.0%/);
 assert.match(html,/10\.0 จุดเปอร์เซ็นต์/);
 assert.match(html,/0\.0%/);
});

test('comparison handles falling values, negative profit, zero bases and missing costs',()=>{
 const data=buildCustomerDashboard([row('current','2026-11-01','โอน',true,5000,-1000),row('previous','2026-09-20','โอน',true,10000,-2000)],undefined,now);
 const html=renderToStaticMarkup(createElement(CustomerDashboard,{data}));
 assert.match(html,/-50\.0%/);
 assert.match(html,/\+50\.0%/);
 const empty=renderToStaticMarkup(createElement(CustomerDashboard,{data:buildCustomerDashboard([],undefined,now)}));
 assert.match(empty,/คำนวณเปอร์เซ็นต์ไม่ได้ \(ฐานเดิม 0\)/);
 assert.doesNotMatch(empty,/NaN|Infinity/);
 const missing=buildCustomerDashboard([row('missing','2026-11-01','โอน',true,10000,null)],undefined,now);
 const missingHtml=renderToStaticMarkup(createElement(CustomerDashboard,{data:missing}));
 assert.match(missingHtml,/รอข้อมูล/);
 assert.doesNotMatch(missingHtml,/NaN|Infinity/);
});
