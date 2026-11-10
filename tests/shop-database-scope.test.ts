import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {PrismaClient} from '@prisma/client';
import {db,withDatabase,bindDatabase,currentShopSlug,isSeparateShopDatabase,currentDatabaseSchema,registerDatabaseSchema} from '../src/lib/db';
import {lineSettings} from '../src/lib/line-settings';
import {account} from '../src/lib/accounts';

const delay=()=>new Promise(resolve=>setTimeout(resolve,2));
function client(name:string){return {
 customer:{count:async()=>name},lineConnection:{findUnique:async()=>null},userAccount:{findUnique:async()=>null},
 $transaction:async(work:(tx:unknown)=>Promise<unknown>)=>work({name}),
} as unknown as PrismaClient;}
test('concurrent shop work and delayed callbacks retain their own database',async()=>{
 const callbacks:Array<()=>Promise<unknown>>=[];
 const results=await Promise.all(['first','second'].map(name=>withDatabase(client(name),async()=>{
  await delay();
  callbacks.push(bindDatabase(async()=>({name:await db.customer.count(),slug:currentShopSlug()})));
  const row=await db.$transaction(async()=>{await delay();return db.customer.count()});
  assert.equal(currentShopSlug(),name);
  assert.equal(isSeparateShopDatabase(),true);
  return row;
 },name)));
 assert.deepEqual(results,['first','second']);
 assert.equal(currentShopSlug(),undefined);
 assert.equal(isSeparateShopDatabase(),false);
 for(const callback of callbacks){const result=await callback() as {name:string;slug:string};assert.equal(result.name,result.slug);}
 await assert.rejects(withDatabase(client('failed'),async()=>{throw Error('failed')}));
 assert.equal(currentShopSlug(),undefined);
});
test('new shops do not inherit main shop LINE credentials or owner fallback',async()=>{
 const variables=['LINE_LOGIN_CHANNEL_ID','LINE_LOGIN_CHANNEL_SECRET','LINE_MESSAGING_CHANNEL_SECRET','LINE_BOT_USER_ID','LINE_OA_BASIC_ID'];
 const saved=variables.map(key=>process.env[key]);
 try{
  for(const key of variables)process.env[key]='main-shop-setting';
  await withDatabase(client('empty'),async()=>{
   assert.equal(await lineSettings(),null);
   assert.equal(await account('owner'),null);
  },'empty');
 }finally{variables.forEach((key,index)=>{if(saved[index]===undefined)delete process.env[key];else process.env[key]=saved[index]})}
});
test('raw customer lookups use the registered tenant schema across concurrent requests',async()=>{
 const first=client('first'),second=client('second');
 registerDatabaseSchema(first,'shop_first');registerDatabaseSchema(second,'shop_second');
 const schemas=await Promise.all([first,second].map(database=>withDatabase(database,async()=>{await delay();return currentDatabaseSchema()})));
 assert.deepEqual(schemas,['shop_first','shop_second']);
});
