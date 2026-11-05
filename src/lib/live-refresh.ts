export function isLivePage(pathname:string|null){return !!pathname&&["/admin","/my-performance","/account"].some(prefix=>pathname===prefix||pathname.startsWith(prefix+"/"));}
type Options={doc:Document;win:Window;refresh:()=>void;pending:()=>boolean;intervalMs?:number;now?:()=>number};
export function installLiveRefresh({doc,win,refresh,pending,intervalMs=5000,now=Date.now}:Options){
 const dirty=new Set<HTMLFormElement>();let submitting=false,lastRefresh=0,stopped=false;
 const tick=()=>{
  for(const form of dirty)if(!form.isConnected)dirty.delete(form);
  if(stopped||doc.visibilityState!=="visible"||win.navigator.onLine===false||pending()||submitting||dirty.size)return;
  if(doc.activeElement?.closest("input, textarea, select, [contenteditable='true'], [role='textbox']"))return;
  if(now()-lastRefresh<intervalMs)return;
  lastRefresh=now();refresh();
 };
 const changed=(event:Event)=>{const form=(event.target as Element|null)?.closest?.("form");if(form)dirty.add(form as HTMLFormElement);};
 const reset=(event:Event)=>{dirty.delete(event.target as HTMLFormElement);};
 const submit=(event:Event)=>{if(!event.defaultPrevented)submitting=true;};
 doc.addEventListener("input",changed);doc.addEventListener("change",changed);doc.addEventListener("reset",reset);doc.addEventListener("submit",submit);doc.addEventListener("visibilitychange",tick);
 win.addEventListener("focus",tick);win.addEventListener("online",tick);
 const interval=win.setInterval(tick,intervalMs);
 return ()=>{stopped=true;win.clearInterval(interval);doc.removeEventListener("input",changed);doc.removeEventListener("change",changed);doc.removeEventListener("reset",reset);doc.removeEventListener("submit",submit);doc.removeEventListener("visibilitychange",tick);win.removeEventListener("focus",tick);win.removeEventListener("online",tick);};
}
