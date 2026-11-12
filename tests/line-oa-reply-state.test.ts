import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveReplyEditor,activateReply} from '../src/lib/line-oa-manager';

function form(active:boolean){
 const events:string[]=[];
 const page:any={getByRole:(role:string,{name}:{name:string})=>{
  const locator:any={last:()=>locator,isVisible:async()=>active&&name==='ใช้การเปลี่ยนแปลง',count:async()=>name==='เริ่มใช้งาน'?(active?0:2):1,
   click:async()=>events.push('click:'+name),waitFor:async()=>events.push('wait:'+name)};
  return locator;
 }};
 return {page,events};
}
test('existing inactive replies save without an active-edit confirmation and activate with duplicate controls',async()=>{
 const draft=form(false);await saveReplyEditor(draft.page);await activateReply(draft.page);
 assert.deepEqual(draft.events,['click:บันทึก','click:เริ่มใช้งาน','wait:หยุดใช้งาน']);
 const active=form(true);await saveReplyEditor(active.page);await activateReply(active.page);
 assert.deepEqual(active.events,['click:ใช้การเปลี่ยนแปลง','wait:ต้องการใช้การเปลี่ยนแปลงหรือไม่','click:ใช้การเปลี่ยนแปลง','wait:หยุดใช้งาน']);
});
