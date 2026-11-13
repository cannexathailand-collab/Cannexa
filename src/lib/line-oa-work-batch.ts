import type {Page} from 'playwright-core';
export const oaWorkerConcurrency=5;
export type OaWorkPage={page:Page;close:()=>Promise<void>};
export type OaWorkSession={openPage:()=>Promise<OaWorkPage>;close:()=>Promise<void>};
// All tabs in a wave share one authentication context. Persist its state
// only after every tab has stopped, avoiding competing session writes.
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
