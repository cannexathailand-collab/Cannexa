import assert from 'node:assert/strict';import {test} from 'node:test';
import {membershipDecision} from '../src/lib/crm-membership-decision';
test('membership drops one step only after two consecutive failed reviews',()=>{
 const first=membershipDecision({level:'VIP Platinum',failedMonths:0},'Bronze',false);assert.equal(first.level,'VIP Platinum');assert.equal(first.failedMonths,1);
 const second=membershipDecision(first,'Bronze',false);assert.equal(second.level,'Gold');assert.equal(second.failedMonths,0);
 assert.equal(membershipDecision(second,'ยังไม่เข้าเกณฑ์',false).level,'Gold');
});
test('passing or missing evidence breaks the failure sequence and promotions reset it',()=>{
 assert.equal(membershipDecision({level:'Gold',failedMonths:1},'Gold',true).failedMonths,0);
 assert.equal(membershipDecision({level:'Gold',failedMonths:1},'ยังไม่เข้าเกณฑ์',false,true).failedMonths,0);
 assert.equal(membershipDecision({level:'Silver',failedMonths:1},'VIP Platinum',true).level,'VIP Platinum');
});
test('a permanently assigned membership survives failed, successful and missing-cost reviews',()=>{
 let previous={level:'Gold',failedMonths:0,decision:'MANUAL_LOCKED'};
 for(let month=0;month<24;month++){
  previous=membershipDecision(previous,month%2?'VIP Platinum':'ยังไม่เข้าเกณฑ์',month%2===1,month%3===0);
  assert.deepEqual(previous,{level:'Gold',failedMonths:0,decision:'MANUAL_LOCKED'});
 }
 const released=membershipDecision({...previous,decision:'MANUAL_SET'},'ยังไม่เข้าเกณฑ์',false);
 assert.equal(released.failedMonths,1);
});
