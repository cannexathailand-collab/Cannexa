import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveReplyEditor,activateReply,savedId,verifyManager} from '../src/lib/line-oa-manager';

function form(active:boolean){
 const events:string[]=[];let currentActive=active;
 const page:any={url:()=> 'https://manager.line.biz/account/@test/autoresponse/edit/123',waitForURL:async()=>{throw Error('no navigation');},goto:async()=>events.push('reopen'),waitForLoadState:async()=>events.push('settled'),reload:async()=>events.push('reload'),getByRole:(role:string,{name:input}:{name:string|RegExp})=>{
  const name=typeof input==='string'?input:'controls';
  const locator:any={first:()=>locator,last:()=>locator,isVisible:async()=>name==='หยุดใช้งาน'?currentActive:active&&name==='ใช้การเปลี่ยนแปลง',count:async()=>name==='เริ่มใช้งาน'?(currentActive?0:2):1,
   click:async()=>{events.push('click:'+name);if(name==='เริ่มใช้งาน')currentActive=true;},waitFor:async()=>events.push('wait:'+name)};
  return locator;
 }};
 return {page,events};
}
test('existing inactive replies save without an active-edit confirmation and activate with duplicate controls',async()=>{
 const draft=form(false);await saveReplyEditor(draft.page);await activateReply(draft.page);
 assert.deepEqual(draft.events,['click:บันทึก','wait:controls','click:เริ่มใช้งาน','wait:หยุดใช้งาน','reopen','wait:หยุดใช้งาน']);
 const active=form(true);await saveReplyEditor(active.page);await activateReply(active.page);
 assert.deepEqual(active.events,['click:ใช้การเปลี่ยนแปลง','wait:ต้องการใช้การเปลี่ยนแปลงหรือไม่','click:ใช้การเปลี่ยนแปลง','wait:controls']);
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

test('activation waits for the active UI before reload and refuses unconfirmed activation',async()=>{
 let activated=false,reloaded=false;
 const page:any={url:()=> 'https://manager.line.biz/account/@test/autoresponse/edit/123',waitForURL:async()=>{throw Error('no navigation');},goto:async()=>{assert.ok(activated);reloaded=true;},reload:async()=>{assert.ok(activated);reloaded=true;},getByRole:(_role:string,{name}:{name:string})=>{
  const locator:any={first:()=>locator,last:()=>locator,isVisible:async()=>false,count:async()=>name==='เริ่มใช้งาน'?1:0,click:async()=>{},waitFor:async()=>{await Promise.resolve();activated=true;}};return locator;
 }};
 await activateReply(page);assert.ok(reloaded);
 reloaded=false;page.getByRole=(_role:string,{name}:{name:string})=>{const locator:any={first:()=>locator,last:()=>locator,isVisible:async()=>false,count:async()=>name==='เริ่มใช้งาน'?1:0,click:async()=>{},waitFor:async()=>{throw Error('not activated');}};return locator;};
 await assert.rejects(activateReply(page),/OA_REPLY_ACTIVATION_VERIFY_FAILED/);assert.equal(reloaded,false);
});

test('account verification waits for the target marker and does not expire all shops for an unverified shop',async()=>{
 let waited=false,current='https://manager.line.biz/account/@one';
 const page:any={goto:async()=>{},url:()=>current,getByText:()=>({first:()=>({waitFor:async()=>{await Promise.resolve();waited=true;}})})};
 await verifyManager(page,'@one');assert.ok(waited);
 page.getByText=()=>({first:()=>({waitFor:async()=>{throw Error('marker missing');}})});
 await assert.rejects(verifyManager(page,'@one'),/OA_ACCOUNT_VERIFY_FAILED/);
 current='https://manager.line.biz/account/@one-extra';
 page.getByText=()=>({first:()=>({waitFor:async()=>{}})});
 await assert.rejects(verifyManager(page,'@one'),/OA_ACCOUNT_VERIFY_FAILED/);
 current='https://access.line.me/login';
 await assert.rejects(verifyManager(page,'@one'),/OA_LOGIN_REQUIRED/);
});

test('repeated account labels are accepted without a strict locator failure',async()=>{
 let chosen=false;
 const page:any={goto:async()=>{},url:()=> 'https://manager.line.biz/account/@one',getByText:()=>({waitFor:async()=>{throw Error('strict mode violation: two labels');},first:()=>({waitFor:async()=>{chosen=true;}})})};
 await verifyManager(page,'@one');assert.ok(chosen);
});

test('a known shop name may confirm its exact account URL when the basic ID is not displayed',async()=>{
 let current='https://manager.line.biz/account/@last';
 const page:any={goto:async()=>{},url:()=>current,getByText:(text:string)=>({first:()=>({waitFor:async()=>{if(text!=='Last shop')throw Error('not shown');}})})};
 await verifyManager(page,'@last','Last shop');
 current='https://manager.line.biz/account/@wrong';
 await assert.rejects(verifyManager(page,'@last','Last shop'),/OA_ACCOUNT_VERIFY_FAILED/);
});

test('an inactive reply whose activation controls hydrate late is activated instead of skipped',async()=>{
 let ready=false,clicked=false,reloaded=false;
 const page:any={url:()=> 'https://manager.line.biz/account/@test/autoresponse/edit/123',waitForURL:async()=>{throw Error('no navigation');},goto:async()=>{reloaded=true;},reload:async()=>{reloaded=true;},getByRole:(_role:string,{name}:{name:string|RegExp})=>{const locator:any={first:()=>locator,last:()=>locator,isVisible:async()=>name==='หยุดใช้งาน'&&clicked,click:async()=>{assert.ok(ready);clicked=true;},waitFor:async()=>{if(name instanceof RegExp){await Promise.resolve();ready=true;}else assert.ok(clicked);}};return locator;}};
 await activateReply(page);assert.ok(ready&&clicked&&reloaded);
});

test('activation that returns to the list reopens the same editor before verifying',async()=>{
 const editor='https://manager.line.biz/account/@test/autoresponse/edit/123';let current=editor,active=false,clicks=0,reopened=false;
 const page:any={url:()=>current,waitForURL:async(match:any)=>{assert.ok(match(new URL(current)));},goto:async(url:string)=>{assert.equal(url,editor);current=url;reopened=true;},getByRole:(_role:string,{name}:{name:string|RegExp})=>{
  const locator:any={first:()=>locator,last:()=>locator,isVisible:async()=>name==='หยุดใช้งาน'&&active&&current===editor,click:async()=>{clicks++;active=true;current='https://manager.line.biz/account/@test/autoresponse';},waitFor:async()=>{if(typeof name==='string'&&name==='หยุดใช้งาน'&&current!==editor)throw Error('button belongs to editor');}};return locator;
 }};
 await activateReply(page);assert.ok(reopened);assert.equal(clicks,1);assert.equal(current,editor);
});
