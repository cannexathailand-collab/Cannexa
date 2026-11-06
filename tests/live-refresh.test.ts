import {test} from "node:test";
import assert from "node:assert/strict";
import {installLiveRefresh,isLivePage} from "../src/lib/live-refresh";
function harness(){
 const documentListeners=new Map<string,Function>(),windowListeners=new Map<string,Function>();let tick:Function=()=>{},time=5000,count=0,pending=false,cleared=false;
 const doc:any={visibilityState:"visible",activeElement:null,querySelector:()=>null,addEventListener:(name:string,fn:Function)=>documentListeners.set(name,fn),removeEventListener:(name:string)=>documentListeners.delete(name)};
 const win:any={navigator:{onLine:true},addEventListener:(name:string,fn:Function)=>windowListeners.set(name,fn),removeEventListener:(name:string)=>windowListeners.delete(name),setInterval:(fn:Function,ms:number)=>{assert.equal(ms,5000);tick=fn;return 1;},clearInterval:()=>{cleared=true;}};
 const stop=installLiveRefresh({doc,win,refresh:()=>count++,pending:()=>pending,now:()=>time});
 return {doc,win,stop,documentListeners,windowListeners,tick:(delay=5000)=>{time+=delay;tick();},count:()=>count,setPending:(value:boolean)=>pending=value,cleared:()=>cleared};
}
test("all authenticated routes refresh automatically, public login and privacy do not",()=>{
 for(const path of ["/admin","/admin/orders","/admin/users","/admin/reviews","/my-performance","/my-performance/orders/own","/account/password"])assert.equal(isLivePage(path),true);
 for(const path of ["/","/login","/privacy","/administrator",null])assert.equal(isLivePage(path),false);
});
test("refresh pauses for hidden offline or pending pages and resumes when usable",()=>{
 const h=harness();h.tick();assert.equal(h.count(),1);h.doc.visibilityState="hidden";h.tick();assert.equal(h.count(),1);h.doc.visibilityState="visible";h.win.navigator.onLine=false;h.tick();assert.equal(h.count(),1);h.win.navigator.onLine=true;h.setPending(true);h.tick();assert.equal(h.count(),1);h.setPending(false);h.windowListeners.get("focus")!();assert.equal(h.count(),2);h.stop();assert.ok(h.cleared());assert.equal(h.documentListeners.size,0);assert.equal(h.windowListeners.size,0);
});
test("unsaved form data prevents refresh even after blur without reading field values",()=>{
 const h=harness(),form={isConnected:true};const control={closest:()=>form,get value():never{return assert.fail("Must not read or store input values");}};
 h.documentListeners.get("input")!({target:control});h.doc.activeElement=null;h.tick();assert.equal(h.count(),0);h.documentListeners.get("reset")!({target:form});h.tick();assert.equal(h.count(),1);h.doc.activeElement={closest:()=>control};h.tick();assert.equal(h.count(),1);h.stop();
});
test("native submission is never interrupted by a background refresh",()=>{
 const h=harness();h.documentListeners.get("submit")!({defaultPrevented:false});h.tick();assert.equal(h.count(),0);h.stop();
});
test('scrolling and open dialogs pause refresh, then resume after idle',()=>{
 const h=harness();h.documentListeners.get('wheel')!();h.tick(1000);assert.equal(h.count(),0);h.tick(4000);assert.equal(h.count(),1);
 h.doc.querySelector=()=>({open:true});h.tick();assert.equal(h.count(),1);h.doc.querySelector=()=>null;h.tick();assert.equal(h.count(),2);h.stop();assert.equal(h.documentListeners.size,0);
});
