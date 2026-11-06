import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {AuditLog} from '@prisma/client';
import {presentStockActivity,stockActivityReport} from '../src/lib/stock-activity';
import {db} from '../src/lib/db';
const log=(action:string,details:any):AuditLog=>({id:'event',actor:'employee-anna',action,entityId:'A1',details,createdAt:new Date('2026-11-06T08:00:00Z')});
test('stock history describes receipt, missing cost/name fill, price edits and deletion with real actor and before/after values',()=>{
 const received=presentStockActivity(log('STOCK_RECEIVED',{code:'A1',quantity:0,receivedBefore:100,receivedAfter:100,remainingBefore:50,remainingAfter:50,nameBefore:null,nameAfter:'New name',costBefore:null,costAfter:150}));
 assert.equal(received.actor,'บัญชี employee-anna');
 assert.ok(received.summary.includes('ชื่อ: ยังไม่มีชื่อ → New name'));
 assert.ok(received.summary.includes('ต้นทุน: ยังไม่ระบุ → 1.50 บาท/G'));
 assert.ok(received.summary.includes('จำนวนรับ: 100 G → 100 G'));
 const updated=presentStockActivity(log('STOCK_PRODUCT_UPDATED',{code:'A1',before:{name:'Old',costSatang:150,salePrices:[{pack:'10G',priceSatang:30000}]},after:{name:'New',costSatang:200,salePrices:[{pack:'10G',priceSatang:25000}]}}));
 assert.ok(updated.summary.some(s=>s.includes('Old → New')));assert.ok(updated.summary.some(s=>s.includes('ราคา 10G')));
 const deleted=presentStockActivity(log('STOCK_PRODUCT_DELETED',{code:'A1',snapshot:{name:'Removed',costSatang:0,remainingQuantity:50}}));
 assert.ok(deleted.summary.includes('ต้นทุนก่อนลบ: 0.00 บาท/G'));
 assert.ok(deleted.summary.includes('คงเหลือก่อนลบ: 50 G'));
});
test('stock activity is stock-only, Thai-day bounded, paginated and not coupled to current product rows',async t=>{
 let query:any;replaceMethod(t,db.auditLog,'count',async()=>101);
 replaceMethod(t,db.auditLog,'findMany',async(input:any)=>{query=input;return [log('STOCK_PRODUCT_DELETED',{code:'DELETED'})];});
 const result=await stockActivityReport({day:'2026-11-06',page:'999'});
 assert.equal(result.page,3);assert.equal(query.take,50);assert.equal(query.skip,100);
 assert.equal(query.where.action.startsWith,'STOCK_');
 assert.equal(query.where.createdAt.gte.toISOString(),'2026-11-05T17:00:00.000Z');
 assert.equal(query.where.createdAt.lt.toISOString(),'2026-11-06T17:00:00.000Z');
 assert.equal(result.events.length,1);assert.ok(result.events[0].summary.includes('รหัสสินค้า: DELETED'));
});

function replaceMethod(t:any,target:any,key:string,fn:any){const original=target[key];target[key]=fn;t.after(()=>{target[key]=original;});}
