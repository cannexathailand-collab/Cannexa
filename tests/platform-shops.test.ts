import {test} from 'node:test';import assert from 'node:assert/strict';
import {newShopSchema,shopDatabase} from '../src/lib/platform-shops';import {db} from '../src/lib/db';
test('shop creation validates identifiers and credentials before provisioning',()=>{
 assert.equal(newShopSchema.parse({name:' Test shop ',slug:'SHOP-ONE',ownerUsername:'Owner_One',password:'test-password'}).slug,'shop-one');
 for(const changes of [{slug:'../other'},{slug:'x;drop table'},{ownerUsername:'x'},{password:'short'}])assert.equal(newShopSchema.safeParse({name:'Shop',slug:'shop-one',ownerUsername:'owner',password:'test-password',...changes}).success,false);
});
test('shop database accepts the registered main schema and rejects arbitrary schemas',()=>{
 assert.equal(shopDatabase('public'),db);
 for(const schema of ['other','public; DROP SCHEMA public','shop_wrong','shop_abc.def'])assert.throws(()=>shopDatabase(schema),/INVALID_SHOP_SCHEMA/);
});
