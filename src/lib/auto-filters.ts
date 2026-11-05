export function installAutoFilters({form,win,onError,delay=350}:{form:HTMLFormElement;win:Window;onError:(text:string)=>void;delay?:number}){
 let timer:number|undefined,submitting=false;
 const cancel=()=>{if(timer!==undefined)win.clearTimeout(timer);timer=undefined;};
 const submit=()=>{submitting=true;cancel();};
 const changed=()=>{cancel();if(submitting)return;timer=win.setTimeout(()=>{
  timer=undefined;if(!form.isConnected||submitting)return;
  const value=(name:string)=>String((form.elements.namedItem(name) as HTMLInputElement|null)?.value??'');const from=value('from'),to=value('to');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||Number(from.slice(0,4))<1000||Number(to.slice(0,4))<1000||!form.checkValidity()){onError('');return;}
  if(from>to){onError('เลือกวันที่สิ้นสุดให้ตรงกับหรือหลังวันที่เริ่มต้น');return;}
  onError('');form.requestSubmit();
 },delay);};
 form.addEventListener('change',changed);form.addEventListener('submit',submit);
 return ()=>{cancel();form.removeEventListener('change',changed);form.removeEventListener('submit',submit);};
}
