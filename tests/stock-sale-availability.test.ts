import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {PrismaClient} from '@prisma/client';
import {withDatabase} from '../src/lib/db';
import {loadStockSaleAvailability,saveStockSaleAvailability,stockSaleAvailabilityId} from '../src/lib/stock-sale-availability';
import {loadCustomerCatalog} from '../src/lib/customer-catalog';
import {checkOrderStock} from '../src/lib/order-stock-admission';
import {cartQuantityError} from '../src/lib/customer-cart';

function fixture(){
 const rows=new Map<string,any>([['active',{id:'active',products:[{code:'ITEM1',category:'General',recommended:false}],version:'old'}]]);
 const audit:any[]=[],locks:string[]=[];
 const client:any={
  shopCatalogSettings:{findUnique:async({where}:any)=>structuredClone(rows.get(where.id)??null),upsert:async({where,create,update}:any)=>{const value=rows.has(where.id)?{...rows.get(where.id),...update}:create;rows.set(where.id,structuredClone(value));return value;}},
  auditLog:{create:async({data}:any)=>{audit.push(data);return data;}},
  $queryRawUnsafe:async(_query:string,key:string)=>{locks.push(key);return [];},
  $transaction:async(fn:any)=>fn(client),
  employeeStockSnapshot:{findUnique:async()=>({fetchedAt:new Date(),rows:[{code:'ITEM1',name:'General item',available:100,prices:[{pack:'10G',priceSatang:1000}]}]})},
  stockProductImage:{findMany:async()=>[]},stockWorkflow:{findUnique:async()=>({enabled:false})},
 };
 const read:any=async()=>({products:[{code:'ITEM1'}]});
 return {client:client as PrismaClient,rows,audit,locks,read};
}
test('availability persists separately, rejects stale changes, and replays without duplicate audit',async()=>{
 const f=fixture();await withDatabase(f.client,async()=>{
  assert.deepEqual(await loadStockSaleAvailability(),[]);
  const closed=await saveStockSaleAvailability('owner',{code:'item1',enabled:false,version:''},f.read);
  assert.equal(closed.enabled,false);assert.equal((await loadStockSaleAvailability())[0].enabled,false);
  assert.deepEqual(f.rows.get('active').products,[{code:'ITEM1',category:'General',recommended:false}]);
  assert.deepEqual(await saveStockSaleAvailability('owner',{code:'ITEM1',enabled:false,version:''},f.read),closed);
  assert.equal(f.audit.length,1);
  await assert.rejects(saveStockSaleAvailability('owner',{code:'ITEM1',enabled:true,version:''},f.read),/STOCK_AVAILABILITY_CHANGED/);
  const opened=await saveStockSaleAvailability('owner',{code:'ITEM1',enabled:true,version:closed.version},f.read);
  assert.equal(opened.enabled,true);assert.equal(f.audit.length,2);
  assert.ok(f.locks.every(key=>key==='stock-sheet-add'));
  await assert.rejects(saveStockSaleAvailability('owner',{code:'MISSING',enabled:false,version:''},f.read),/STOCK_PRODUCT_NOT_FOUND/);
  assert.equal(f.audit.length,2);
 });
});
test('disabled product stays visible with its price and balance but cannot enter a cart or LINE order',async()=>{
 const f=fixture();await withDatabase(f.client,async()=>{
  await saveStockSaleAvailability('owner',{code:'ITEM1',enabled:false,version:''},f.read);
  const catalog=await loadCustomerCatalog(f.client,{merchandising:false}),product=catalog.products[0];
  assert.equal(catalog.products.length,1);assert.equal(product.available,100);assert.equal(product.prices[0].priceSatang,1000);assert.equal(product.saleEnabled,false);
  assert.match(cartQuantityError([],product,product.prices[0],1)??'',/ไม่พร้อมขาย/);
  const rejected=await checkOrderStock(f.client,'สินค้า: ITEM1 x 10 G',f.read);assert.match(rejected?.reasons[0]??'',/ITEM1 ไม่พร้อมขาย/);
  const malformed=await checkOrderStock(f.client,'สินค้า: item1 ไม่ทราบจำนวน',f.read);assert.match(malformed?.reasons[0]??'',/ITEM1 ไม่พร้อมขาย/);
  const open=await saveStockSaleAvailability('owner',{code:'ITEM1',enabled:true,version:(await loadStockSaleAvailability())[0].version},f.read);
  assert.equal(open.enabled,true);assert.equal(await checkOrderStock(f.client,'สินค้า: ITEM1 x 10 G',f.read),null);
 });
});
test('availability is isolated by database, and corrupted saved settings fail closed',async()=>{
 const a=fixture(),b=fixture();await withDatabase(a.client,()=>saveStockSaleAvailability('owner',{code:'ITEM1',enabled:false,version:''},a.read));
 assert.deepEqual(await withDatabase(b.client,()=>loadStockSaleAvailability()),[]);
 a.rows.set(stockSaleAvailabilityId,{products:[{code:'ITEM1',enabled:'false'}]});
 await assert.rejects(withDatabase(a.client,()=>loadStockSaleAvailability()),/STOCK_AVAILABILITY_INVALID/);
});
