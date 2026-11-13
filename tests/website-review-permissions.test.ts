import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canReviewWebsiteOrders,websiteReviewRequest} from '../src/lib/website-review-permissions';

test('only regular sales staff and the existing owner may review website orders',()=>{
 for(const role of ['employee','owner'])assert.equal(canReviewWebsiteOrders({role,username:'reviewer'}),true);
 for(const role of ['sales','admin','store','manager','viewer']){
  const account={role,username:'other'};
  assert.equal(canReviewWebsiteOrders(account),false);
  assert.throws(()=>websiteReviewRequest(account,{status:'APPROVED'}),/WEBSITE_REVIEW_FORBIDDEN/);
 }
});
test('commission seller for a staff approval comes from the login, ignoring a forged recipient',()=>{
 const value={id:'example',status:'APPROVED',sellerCode:'someone-else',amountSatang:10000};
 const input=websiteReviewRequest({role:'employee',username:'staff01',affiliateId:'staff-affiliate'},value) as typeof value;
 assert.equal(input.sellerCode,'staff01');
 assert.equal(value.sellerCode,'someone-else');
 assert.equal(input.amountSatang,10000);
});
test('unlinked staff cannot approve while rejection and owner review keep existing behavior',()=>{
 assert.throws(()=>websiteReviewRequest({role:'employee',username:'staff01',affiliateId:null},{status:'APPROVED'}),/EMPLOYEE_AFFILIATE_REQUIRED/);
 const rejected={id:'example',status:'REJECTED'};
 assert.deepEqual(websiteReviewRequest({role:'employee',username:'staff01'},rejected),rejected);
 const ownerInput={status:'APPROVED',sellerCode:'selected'};
 assert.deepEqual(websiteReviewRequest({role:'owner',username:'owner'},ownerInput),ownerInput);
});
