import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveReplyEditor,activateReply,savedId} from '../src/lib/line-oa-manager';

function form(active:boolean){
 const events:string[]=[];
 const page:any={waitForLoadState:async()=>events.push('settled'),reload:async()=>events.push('reload'),getByRole:(role:string,{name}:{name:string})=>{
  const locator:any={last:()=>locator,isVisible:async()=>active&&name==='ใช้การเปลี่ยนแปลง',count:async()=>name==='เริ่มใช้งาน'?(active?0:2):1,
   click:async()=>events.push('click:'+name),waitFor:async()=>events.push('wait:'+name)};
  return locator;
 }};
 return {page,events};
}
test('existing inactive replies save without an active-edit confirmation and activate with duplicate controls',async()=>{
 const draft=form(false);await saveReplyEditor(draft.page);await activateReply(draft.page);
 assert.deepEqual(draft.events,['click:บันทึก','click:เริ่มใช้งาน','settled','reload','wait:หยุดใช้งาน']);
 const active=form(true);await saveReplyEditor(active.page);await activateReply(active.page);
 assert.deepEqual(active.events,['click:ใช้การเปลี่ยนแปลง','wait:ต้องการใช้การเปลี่ยนแปลงหรือไม่','click:ใช้การเปลี่ยนแปลง','wait:หยุดใช้งาน']);
});
test('new item verification waits for list navigation before opening the saved item',async()=>{
 let url='https://manager.line.biz/account/@test/autoresponse/create';const events:string[]=[];
 const found:any={first:()=>found,waitFor:async()=>{},count:async()=>1,click:async()=>{events.push('open saved');url='https://manager.line.biz/account/@test/autoresponse/edit/123';}};
 const page:any={url:()=>url,waitForURL:async(pattern:RegExp)=>{
  if(url.endsWith('/create'))url='https://manager.line.biz/account/@test/autoresponse';
  assert.ok(pattern.test(url));events.push('navigation');
 },waitForLoadState:async()=>{},getByPlaceholder:()=>({fill:async()=>events.push('filter')}),getByRole:()=>({click:async()=>{}}),locator:()=>({getByRole:()=>found})};
 assert.equal(await savedId(page,'autoresponse','Test'), '123');
 assert.deepEqual(events,['navigation','filter','open saved','navigation']);
});
