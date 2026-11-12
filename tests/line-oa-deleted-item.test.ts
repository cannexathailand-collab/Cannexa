import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openManagerItem} from '../src/lib/line-oa-manager';

function pageWithDeletedItem(matches:number){
 const visits:string[]=[];let creates=0,opens=0;
 const page:any={
  goto:async(url:string)=>{visits.push(url);},
  getByPlaceholder:()=>({waitFor:async()=>{throw Error('deleted');},fill:async()=>{}}),
  getByRole:(_role:string,{name}:{name:string})=>({click:async()=>{if(name==='สร้างใหม่')creates++;},waitFor:async()=>{throw Error('no guide');}}),
  waitForTimeout:async()=>{},waitForLoadState:async()=>{},waitForURL:async()=>{},
  locator:()=>({getByRole:()=>({count:async()=>matches,click:async()=>{opens++;}})}),
 };
 return {page,visits,get creates(){return creates;},get opens(){return opens;}};
}
test('deleted remote IDs are reconciled by title only inside the selected OA',async()=>{
 const existing=pageWithDeletedItem(1);
 assert.equal(await openManagerItem(existing.page,'@second','autoresponse','ข้อมูล A1','123'),false);
 assert.equal(existing.creates,0);assert.equal(existing.opens,1);
 assert.deepEqual(existing.visits,['https://manager.line.biz/account/@second/autoresponse/edit/123','https://manager.line.biz/account/@second/autoresponse']);
 const missing=pageWithDeletedItem(0);
 assert.equal(await openManagerItem(missing.page,'@second','autoresponse','ข้อมูล A1','123'),true);
 assert.equal(missing.creates,1);
 const duplicate=pageWithDeletedItem(2);
 await assert.rejects(openManagerItem(duplicate.page,'@second','autoresponse','ข้อมูล A1','123'),/OA_DUPLICATE_ITEM/);
 assert.equal(duplicate.creates,0);
});
