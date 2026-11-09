import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {db} from '../src/lib/db';
import {StockDispatchHistory} from '../src/app/stock-dispatch-history';
test('stock dispatch history shows recipient names and links names and tracking to the correct workspace',async t=>{
 const originals={orders:db.orderIntake.findMany,count:db.stockDispatch.count,rows:db.stockDispatch.findMany,shipments:db.shipment.findMany,settings:db.orderRoundSettings.findUnique};
 t.after(()=>{db.orderIntake.findMany=originals.orders;db.stockDispatch.count=originals.count;db.stockDispatch.findMany=originals.rows;db.shipment.findMany=originals.shipments;db.orderRoundSettings.findUnique=originals.settings;});
 db.orderIntake.findMany=(async()=>[{id:'first',recipient:'Order name'},{id:'second',recipient:'Order fallback'},{id:'third',recipient:null}]) as any;
 db.stockDispatch.count=(async()=>3) as any;
 db.stockDispatch.findMany=(async()=>['first','second','third'].map((id,index)=>({id,orderId:id,orderNumber:'ORDER-'+index,tracking:'TRACK-'+index,candidateTracking:null,status:'PENDING',items:[],processedAt:null,dispatchedAt:null,historySavedAt:null}))) as any;
 db.shipment.findMany=(async()=>[{orderId:'first',recipient:'Shipping recipient'}]) as any;
 db.orderRoundSettings.findUnique=(async()=>null) as any;
 const html=renderToStaticMarkup(await StockDispatchHistory({day:'2026-11-08'}));
 assert.ok(html.includes('ผู้รับ / เลขพัสดุ'));assert.ok(html.includes('Shipping recipient'));assert.ok(html.includes('Order fallback'));assert.ok(html.includes('ยังไม่ระบุชื่อผู้รับ'));assert.ok(html.includes('href="/admin/orders/first/review"'));assert.match(html,/<a[^>]*>\s*<strong>Shipping recipient<\/strong><span>TRACK-0<\/span><\/a>/);
 const store=renderToStaticMarkup(await StockDispatchHistory({day:'2026-11-08',orderBaseHref:'/admin/store-orders/',orderSuffix:''}));assert.ok(store.includes('href="/admin/store-orders/first"'));assert.ok(!store.includes('/admin/orders/first/review'));
});
