import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moveReplyVideoFirst} from '../src/lib/line-oa-video';
function fixture(initial:number,{button=true,enabled=true,moves=true,duplicate=false}:{button?:boolean;enabled?:boolean;moves?:boolean;duplicate?:boolean}={}){
 let position=initial,pending=false,presses=0,arrowReads=0;const events:string[]=[];
 const arrow:any={first:()=>arrow,count:async()=>{arrowReads++;return button?1:0;},isEnabled:async()=>enabled,press:async()=>{throw Error('keyboard focus must not be used');},evaluate:async(fn:any)=>fn({click:()=>{assert.equal(pending,false,'must wait for each move');presses++;pending=true;events.push('press');}})};
 const blocks:any={filter:()=>({locator:()=>({filter:()=>arrow})}),evaluateAll:async(fn:any)=>fn(Array.from({length:5},(_,index)=>({querySelector:()=>index===position||duplicate&&index===position+1?{}:null})))};
 const page:any={locator:(selector:string)=>selector.startsWith('main')?blocks:{},waitForFunction:async(_fn:any,before:number,options:any)=>{assert.equal(before,position);assert.equal(options.timeout,10000);assert.ok(pending);events.push('wait');if(!moves)throw Error('timeout');position--;pending=false;}};
 return {page,events,get position(){return position},get presses(){return presses},get arrowReads(){return arrowReads}};
}
test('a video already first succeeds without requiring an up button',async()=>{const f=fixture(0,{button:false});await moveReplyVideoFirst(f.page);assert.equal(f.presses,0);assert.equal(f.arrowReads,0);});
test('video moves to first position and waits for every rendered reorder',async()=>{const f=fixture(4);await moveReplyVideoFirst(f.page);assert.equal(f.position,0);assert.equal(f.presses,4);assert.deepEqual(f.events,['press','wait','press','wait','press','wait','press','wait']);});
test('missing controls and unchanged position report specific failures without repeated presses',async()=>{for(const options of [{button:false},{enabled:false}]){const f=fixture(2,options);await assert.rejects(moveReplyVideoFirst(f.page),/OA_VIDEO_ORDER_CONTROL_FAILED/);assert.equal(f.presses,0);}const f=fixture(2,{moves:false});await assert.rejects(moveReplyVideoFirst(f.page),/OA_VIDEO_ORDER_MOVE_FAILED/);assert.equal(f.presses,1);});
test('missing or duplicate video blocks stop rather than reordering unrelated content',async()=>{await assert.rejects(moveReplyVideoFirst(fixture(-1).page),/OA_VIDEO_LAYOUT_CHANGED/);await assert.rejects(moveReplyVideoFirst(fixture(1,{duplicate:true}).page),/OA_VIDEO_LAYOUT_CHANGED/);});
