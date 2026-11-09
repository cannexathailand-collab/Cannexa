import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {OrderShippingDetails} from '../src/app/order-shipping-details';

test('shared shipping detail shows contacts and items before payment and copy',()=>{
 const html=renderToStaticMarkup(createElement(OrderShippingDetails,{data:{recipient:'Recipient',phone:'0800000000',address:'Full address',payment:'COD',amountSatang:123400,items:[{code:'CG1',name:'Product',quantityMilliG:20000}]},tracking:'TRACK123'}));
 for(const value of ['Recipient','0800000000','Full address','CG1','Product','20','1,234.00 บาท','เก็บเงินปลายทาง (COD)','TRACK123','คัดลอกข้อมูลจัดส่ง'])assert.ok(html.includes(value),value);
 assert.ok(html.indexOf('Full address')<html.indexOf('CG1'));
 assert.ok(html.indexOf('CG1')<html.indexOf('การชำระเงิน'));
 assert.ok(html.indexOf('การชำระเงิน')<html.indexOf('คัดลอกข้อมูลจัดส่ง'));
});

test('shared detail keeps copy and explicit unknown values on every surface',()=>{
 const html=renderToStaticMarkup(createElement(OrderShippingDetails,{data:{recipient:null,phone:null,address:null,payment:null,amountSatang:null,items:[]}}));
 assert.ok(html.includes('คัดลอกข้อมูลจัดส่ง'));
 assert.ok(html.includes('ยังไม่ทราบยอด'));
});

test('order team is displayed directly after the seller',()=>{
 const html=renderToStaticMarkup(createElement(OrderShippingDetails,{teamName:'Greenhub',sellerName:'Seller',data:{recipient:'Customer',phone:null,address:null,payment:null,amountSatang:null,items:[]}}));
 assert.ok(html.indexOf('Seller')<html.indexOf('Greenhub'));assert.ok(html.indexOf('Greenhub')<html.indexOf('Customer'));
});
