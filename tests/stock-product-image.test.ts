import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {db} from '../src/lib/db';
import {encryptGmail} from '../src/lib/gmail';
import {clearDeletedStockImages,saveStockProductImage} from '../src/lib/stock-product-image';

const png=Buffer.from([137,80,78,71,13,10,26,10]);
const image=(bytes=png)=>'data:image/png;base64,'+bytes.toString('base64');

test('stock images require versions, normalize codes, and retry identical content without duplicate writes',async t=>{
 const transaction=db.$transaction;
 t.after(()=>{db.$transaction=transaction;});
 let saved:any=null,writes=0,audits=0;
 const tx={
  $queryRawUnsafe:async()=>[{locked:true}],
  stockSheetsConnection:{findUnique:async()=>null},
  stockProduct:{findUnique:async({where}:any)=>{assert.equal(where.code,'A1');return {code:'A1'};}},
  stockProductImage:{findUnique:async()=>saved,upsert:async({create,update}:any)=>{writes++;const data=saved?update:create;saved={code:'A1',imageVersion:data.imageVersion,imageMime:data.imageMime,createdAt:new Date(),updatedAt:new Date()};return saved;}},
  auditLog:{create:async({data}:any)=>{audits++;assert.ok(!JSON.stringify(data).includes(png.toString('base64')));}},
 };
 (db as any).$transaction=async(fn:any)=>fn(tx);
 await assert.rejects(saveStockProductImage('owner',{code:'A1',image:image()}),/INVALID_STOCK_IMAGE/);
 const first=await saveStockProductImage('owner',{code:' ａ１ ',expectedVersion:null,image:image()});
 assert.equal(first.code,'A1');assert.ok(!('imageData' in first));
 assert.equal((await saveStockProductImage('owner',{code:'A1',expectedVersion:null,image:image()})).imageVersion,first.imageVersion);
 assert.equal(writes,1);assert.equal(audits,1);
 await assert.rejects(saveStockProductImage('owner',{code:'A1',expectedVersion:null,image:image(Buffer.concat([png,Buffer.from('changed')]))}),/STOCK_IMAGE_VERSION_CONFLICT/);
 const updated=await saveStockProductImage('owner',{code:'A1',expectedVersion:first.imageVersion,image:image(Buffer.concat([png,Buffer.from('changed')]))});
 assert.notEqual(updated.imageVersion,first.imageVersion);assert.equal(writes,2);
 tx.$queryRawUnsafe=async()=>[{locked:false}];
 await assert.rejects(saveStockProductImage('owner',{code:'A1',expectedVersion:updated.imageVersion,image:image()}),/STOCK_BUSY/);
});

test('live-only images validate against Sheets and delete replay preserves re-added product images',async t=>{
 const original={fetch:globalThis.fetch,transaction:db.$transaction,connection:db.stockSheetsConnection.findUnique,secret:process.env.SESSION_SECRET};
 t.after(()=>{globalThis.fetch=original.fetch;db.$transaction=original.transaction;db.stockSheetsConnection.findUnique=original.connection;if(original.secret===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=original.secret;});
 process.env.SESSION_SECRET='isolated-stock-image-unit';
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const config={type:'service_account',client_email:'unit@unit.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})};
 (db.stockSheetsConnection as any).findUnique=async()=>({encryptedConfig:encryptGmail(config),revision:'stock-image-unit'});
 globalThis.fetch=async url=>String(url).includes('oauth2.googleapis.com')?Response.json({access_token:'unit-token',expires_in:3600}):String(url).includes('/values/')?Response.json({values:[['','','รายการ','','จำนวนรับ','จำนวนจ่าย','จำนวนคงเหลือ'],[],['','Re-added product','B1',1,20,0,20]]}):Response.json({sheets:[{properties:{sheetId:1,title:'7.11.69',gridProperties:{rowCount:3,columnCount:12}}}]});
 const images=new Map<string,any>([['A1',{code:'A1'}],['B1',{code:'B1'}]]);
 const tx={
  $queryRawUnsafe:async()=>[{locked:true}],
  stockSheetsConnection:{findUnique:async()=>({id:'active'})},
  stockProduct:{findUnique:async()=>assert.fail('Live validation must not require cached StockProduct')},
  stockProductImage:{findUnique:async()=>null,upsert:async({create}:any)=>({code:create.code,imageVersion:create.imageVersion,imageMime:create.imageMime}),findMany:async({where}:any)=>[...images.values()].filter(row=>where.code.in.includes(row.code)),deleteMany:async({where}:any)=>{for(const code of where.code.in)images.delete(code);}},
  auditLog:{create:async()=>{}},
 };
 (db as any).$transaction=async(fn:any)=>fn(tx);
 assert.equal((await saveStockProductImage('owner',{code:'B1',expectedVersion:null,image:image()})).code,'B1');
 await assert.rejects(saveStockProductImage('owner',{code:'A1',expectedVersion:null,image:image()}),/STOCK_PRODUCT_NOT_FOUND/);
 await clearDeletedStockImages(tx as any,['A1','B1'],true);
 assert.equal(images.has('A1'),false);assert.equal(images.has('B1'),true);
 await clearDeletedStockImages(tx as any,['B1']);
 assert.equal(images.size,0);
});
