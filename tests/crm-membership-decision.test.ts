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
