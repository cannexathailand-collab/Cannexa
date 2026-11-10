import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authenticateShop,validShopSession,shopCookieName,shopPath,type ShopSession} from '../src/lib/shop-session';
import {db} from '../src/lib/db';
import {passwordHash} from '../src/lib/crypto';

const account={username:'owner',version:'version-a',active:true};
const session:ShopSession={audience:'shop',shopId:'shop-a',username:'owner',version:'version-a',exp:2000};
test('shop sessions are bound to shop, account, version and expiration',()=>{
 assert.equal(validShopSession(session,'shop-a',account,1000),true);
 assert.equal(validShopSession(session,'shop-b',account,1000),false);
 assert.equal(validShopSession(session,'shop-a',{...account,active:false},1000),false);
 assert.equal(validShopSession(session,'shop-a',{...account,version:'reset'},1000),false);
 assert.equal(validShopSession(session,'shop-a',{...account,username:'another'},1000),false);
 assert.equal(validShopSession(session,'shop-a',account,2000),false);
 assert.equal(validShopSession({...session,exp:NaN},'shop-a',account,1000),false);
 assert.equal(validShopSession({...session,audience:'admin' as 'shop'},'shop-a',account,1000),false);
 assert.equal(validShopSession(null,'shop-a',account,1000),false);
 assert.equal(validShopSession(session,'shop-a',null,1000),false);
});
test('each shop has a distinct session cookie and encoded entry path',()=>{
 assert.notEqual(shopCookieName('shop-a'),shopCookieName('shop-b'));
 assert.equal(shopPath('example-shop'),'/shops/example-shop');
 assert.equal(shopPath('../admin'),'/shops/..%2Fadmin');
});
test('shop login uses the selected database account without the main owner fallback',async()=>{
 const findShop=db.platformShop.findFirst,findAccount=db.userAccount.findUnique;
 const shop={id:'test-shop',slug:'test-shop',schemaName:'public',active:true};
 const stored={...account,salt:'test-salt',hash:passwordHash('test-password','test-salt')};
 let enabled=true,found=true;
 db.platformShop.findFirst=(async()=>enabled?shop:null) as unknown as typeof findShop;
 db.userAccount.findUnique=(async()=>found?stored:null) as unknown as typeof findAccount;
 try{
  assert.ok(await authenticateShop('test-shop','owner','test-password'));
  assert.equal(await authenticateShop('test-shop','owner','wrong-password'),null);
  assert.equal(await authenticateShop('test-shop','owner','x'.repeat(257)),null);
  found=false;
  assert.equal(await authenticateShop('test-shop','owner','test-password'),null);
  found=true;enabled=false;
  assert.equal(await authenticateShop('test-shop','owner','test-password'),null);
 }finally{db.platformShop.findFirst=findShop;db.userAccount.findUnique=findAccount;}
});
