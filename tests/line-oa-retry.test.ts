import {test} from 'node:test';
import assert from 'node:assert/strict';
import {oaRetryDelay} from '../src/lib/line-oa-retry';
test('transient failures retry with a bounded backoff without retrying authorization or identity conflicts',()=>{
 for(const code of ['OA_VIDEO_UPLOAD_FAILED','OA_TEXT_VERIFY_FAILED','OPENAI_RATE_LIMIT','RESEARCH_UNVERIFIED','locator.click: Timeout']){
  assert.deepEqual([0,1,2,3].map(count=>oaRetryDelay(new Error(code),count)),[10000,30000,90000,null]);
 }
 for(const code of ['OA_LOGIN_REQUIRED','OA_KEYWORD_CONFLICT','OA_ARTIFACT_CHANGED','OA_DUPLICATE_ITEM','DRIVE_VIDEO_DUPLICATE','DRIVE_RECONNECT','OPENAI_KEY_REJECTED','OA_ACCOUNT_MISMATCH'])assert.equal(oaRetryDelay(new Error(code),0),null);
});
