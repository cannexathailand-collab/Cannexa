import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customerAccountLabel,customerAccountUrl,cardActionLink} from '../src/lib/line-oa-links';
test('card account action opens only the customer profile without a product selection',t=>{
 const prior=process.env.APP_URL;process.env.APP_URL='https://example.org/admin';
 t.after(()=>{if(prior===undefined)delete process.env.APP_URL;else process.env.APP_URL=prior;});
 const url=new URL(customerAccountUrl());
 assert.equal(url.href,'https://example.org/customer?tab=profile');
 assert.equal(url.searchParams.has('product'),false);
 assert.equal(url.searchParams.has('cart'),false);
 assert.ok(customerAccountLabel.length<=15);
});

test('card action copies an explicit custom link and leaves blank links on the account page',t=>{
 const old=process.env.APP_URL;process.env.APP_URL='https://example.org';t.after(()=>{if(old===undefined)delete process.env.APP_URL;else process.env.APP_URL=old;});
 assert.deepEqual(cardActionLink({linkUrl:'https://example.com/information'}),{label:'เปิดลิงก์',url:'https://example.com/information'});
 assert.equal(cardActionLink({}).url,'https://example.org/customer?tab=profile');
 for(const linkUrl of ['javascript:alert(1)','https://user:pass@example.com/'])assert.throws(()=>cardActionLink({linkUrl}));
});
