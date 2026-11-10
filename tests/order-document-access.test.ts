import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canAccessOrderDocument} from '../src/lib/order-document-access';

test('operational staff can use documents for the shared primary order list',()=>{
 for(const role of ['owner','admin','manager','employee','sales','store']){
  assert.equal(canAccessOrderDocument({role,username:'staff'},'another',false,true),true);
 }
 assert.equal(canAccessOrderDocument({role:'viewer',username:'viewer'},null,false),true);
 assert.equal(canAccessOrderDocument({role:'viewer',username:'viewer'},null,false,true),false);
 assert.equal(canAccessOrderDocument({role:'unknown',username:'unknown'},null,false),false);
});

test('tenant sales staff keep their existing own-order boundary',()=>{
 for(const role of ['employee','sales']){
  assert.equal(canAccessOrderDocument({role,username:'staff'},'staff',true,true),true);
  assert.equal(canAccessOrderDocument({role,username:'staff'},'another',true,true),false);
 }
 assert.equal(canAccessOrderDocument({role:'owner',username:'owner'},'another',true,true),true);
});
