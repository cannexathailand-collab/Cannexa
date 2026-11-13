import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customerAccountLabel,customerAccountUrl} from '../src/lib/line-oa-links';
test('card account action opens only the customer profile without a product selection',t=>{
 const prior=process.env.APP_URL;process.env.APP_URL='https://example.org/admin';
 t.after(()=>{if(prior===undefined)delete process.env.APP_URL;else process.env.APP_URL=prior;});
 const url=new URL(customerAccountUrl());
 assert.equal(url.href,'https://example.org/customer?tab=profile');
 assert.equal(url.searchParams.has('product'),false);
 assert.equal(url.searchParams.has('cart'),false);
 assert.ok(customerAccountLabel.length<=15);
});
