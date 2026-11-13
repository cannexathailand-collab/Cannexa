import type {Page,Browser,BrowserContext} from 'playwright-core';
export const oaWorkerConcurrency=5;
export type OaWorkPage={page:Page;close:()=>Promise<void>};
export type OaWorkSession={openPage:()=>Promise<OaWorkPage>;close:()=>Promise<void>};
// Each shop gets an independent client-side state. Persist authentication
// once after the wave, avoiding concurrent writes to the saved login.
export async function runOaWorkBatch(createSession:()=>Promise<OaWorkSession>,work:(openPage:()=>Promise<OaWorkPage>,concurrency:number)=>Promise<boolean>){
 let session:Promise<OaWorkSession>|undefined;
 const openPage=async()=>{session??=createSession();return (await session).openPage();};
 try{
  const results=await Promise.allSettled(Array.from({length:oaWorkerConcurrency},()=>work(openPage,oaWorkerConcurrency)));
  const failed=results.find((result):result is PromiseRejectedResult=>result.status==='rejected');
  if(failed)throw failed.reason;
  return results.some(result=>result.status==='fulfilled'&&result.value);
 }finally{if(session)await session.then(value=>value.close(),()=>{});}
}

type OaStorageState=Awaited<ReturnType<BrowserContext['storageState']>>;
export function createIsolatedOaSession(browser:Pick<Browser,'newContext'>,saved:OaStorageState|undefined,persist:(state:OaStorageState)=>Promise<void>):OaWorkSession{
 const contexts=new Set<BrowserContext>();
 let latest:OaStorageState|undefined;
 async function closeContext(context:BrowserContext){
  if(!contexts.delete(context))return;
  try{latest=await context.storageState({indexedDB:true});}finally{await context.close();}
 }
 return {
  openPage:async()=>{
   const context=await browser.newContext({locale:'th-TH',timezoneId:'Asia/Bangkok',viewport:{width:1280,height:900},...(saved?{storageState:saved}:{})});
   contexts.add(context);
   const page=await context.newPage();page.setDefaultTimeout(20000);
   return {page,close:()=>closeContext(context)};
  },
  close:async()=>{
   const cleanup=await Promise.allSettled([...contexts].map(closeContext));
   if(latest)await persist(latest);
   const failure=cleanup.find((result):result is PromiseRejectedResult=>result.status==='rejected');if(failure)throw failure.reason;
  },
 };
}
