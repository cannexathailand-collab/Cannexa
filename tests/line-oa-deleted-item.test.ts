import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openManagerItem,openReplyByCode,matchesReplyCode} from '../src/lib/line-oa-manager';

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
function keywordPage(rows:Record<string,string[]>){
 let url='',creates=0;const visits:string[]=[];
 const page:any={
  goto:async(value:string)=>{url=value;visits.push(value);},
  waitForTimeout:async()=>{},waitForLoadState:async()=>{},waitForURL:async()=>{},
  getByPlaceholder:()=>({fill:async()=>{}}),
  getByRole:(_role:string,{name}:{name:string})=>({click:async()=>{if(name==='สร้างใหม่')creates++;}}),
  locator:(selector:string)=>selector.startsWith('input')?{
   first:()=>({waitFor:async()=>{if(!rows[url.split('/').at(-1)!]?.length)throw Error('missing');}}),
   evaluateAll:async()=>rows[url.split('/').at(-1)!]??[],
  }:{evaluateAll:async()=>Object.keys(rows).map(id=>'/account/@target/autoresponse/edit/'+id)},
 };
 return {page,visits,get creates(){return creates;}};
}
test('SKU keyword is the reply identity even when a saved URL was deleted or a title changed',async()=>{
 assert.equal(matchesReplyCode(['AE010'],'AE01'),false);
 const existing=keywordPage({'2':['AE010'],'3':['AE01']});
 assert.equal(await openReplyByCode(existing.page,'@target','AE01','1'),false);
 assert.equal(existing.creates,0);assert.match(existing.visits.at(-1)!,/\/3$/);
 const missing=keywordPage({'2':['AE010']});
 assert.equal(await openReplyByCode(missing.page,'@target','AE01','1'),true);
 assert.equal(missing.creates,1);
 const duplicate=keywordPage({'2':['AE01'],'3':['AE01']});
 await assert.rejects(openReplyByCode(duplicate.page,'@target','AE01'),/OA_DUPLICATE_ITEM/);
 assert.equal(duplicate.creates,0);
});
