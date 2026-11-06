import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lineCustomerDestination} from '../src/lib/line-customer-destination';
test('confirmed friends go straight to native LINE chat without a customer-code page',()=>{
 assert.equal(lineCustomerDestination('@my.shop',true),'https://line.me/R/oaMessage/%40my.shop');
});
test('nonfriends and unknown friendship go to the native add-friend profile',()=>{
 for(const flag of [false,null])assert.equal(lineCustomerDestination('@my.shop',flag),'https://line.me/R/ti/p/%40my.shop');
});
test('the LINE destination cannot be replaced with another host',()=>{
 assert.throws(()=>lineCustomerDestination('https://other.test',true));
 assert.throws(()=>lineCustomerDestination('@shop/../../other',true));
});
