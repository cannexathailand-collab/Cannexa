import {runOaWorkBatch,createIsolatedOaSession} from '../../src/lib/line-oa-work-batch';
import {chromium,type BrowserContext,type Page} from 'playwright-core';
import {db} from '../../src/lib/db';
import {oaCommand,sealOaState,unsealOaState} from '../../src/lib/line-oa-browser';
import {managerUrl,verifyManager} from '../../src/lib/line-oa-manager';
import {processOaStep} from '../../src/lib/line-oa-process';
import {discoverOaAccounts,saveOaAccounts} from '../../src/lib/line-oa-accounts';

async function main(){
let stopping=false;
const browser=await chromium.launch({headless:true});
browser.on('disconnected',()=>{stopping=true;});
let login:{id:string;context:BrowserContext;page:Page}|undefined;
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function openPage(){
 const connection=await db.lineOaBrowser.findUniqueOrThrow({where:{id:'active'}});
 const saved=unsealOaState(connection.encryptedConfig);
 const context=await browser.newContext({locale:'th-TH',timezoneId:'Asia/Bangkok',viewport:{width:1280,height:900},...(saved.cookies?{storageState:saved}:{})});
 const page=await context.newPage();page.setDefaultTimeout(20000);
 return {page,close:async()=>{const state=await context.storageState({indexedDB:true});await db.lineOaBrowser.update({where:{id:'active'},data:{encryptedConfig:sealOaState(state)}});await context.close();}};
}
async function createWorkSession(){
 const connection=await db.lineOaBrowser.findUniqueOrThrow({where:{id:'active'}});
 const saved=unsealOaState(connection.encryptedConfig);
 return createIsolatedOaSession(browser,saved.cookies?saved:undefined,async state=>{
  await db.lineOaBrowser.update({where:{id:'active'},data:{encryptedConfig:sealOaState(state)}});
 });
}
async function loginStep(){
 const connection=await db.lineOaBrowser.findUnique({where:{id:'active'}});if(!connection)return false;
 await db.lineOaBrowser.update({where:{id:'active'},data:{heartbeatAt:new Date()}});
 if(!['LOGIN_REQUESTED','AWAITING_LOGIN'].includes(connection.status)){if(login){await login.context.close();login=undefined;}return false;}
 if(!connection.sessionId||!connection.sessionExpiresAt||connection.sessionExpiresAt<new Date()){
  await db.lineOaBrowser.update({where:{id:'active'},data:{status:'EXPIRED',sessionId:null,screenshotData:null}});
  await db.lineOaBrowserCommand.deleteMany({where:{sessionId:connection.sessionId??''}});if(login){await login.context.close();login=undefined;}return false;
 }
 if(login?.id!==connection.sessionId){
  if(login)await login.context.close();const saved=unsealOaState(connection.encryptedConfig);
  const context=await browser.newContext({locale:'th-TH',timezoneId:'Asia/Bangkok',viewport:{width:1280,height:900},...(saved.cookies?{storageState:saved}:{})});
  const page=await context.newPage();await page.goto(managerUrl(connection.account),{waitUntil:'domcontentloaded'});
  login={id:connection.sessionId,context,page};await db.lineOaBrowser.update({where:{id:'active'},data:{status:'AWAITING_LOGIN'}});
  context.on('page',page=>{if(login?.context===context)login.page=page;});
 }
 if(login.page.isClosed()){const page=login.context.pages().at(-1);if(!page)throw Error('OA_LOGIN_WINDOW_CLOSED');login.page=page;}
 const commands=await db.lineOaBrowserCommand.findMany({where:{sessionId:login.id},orderBy:{createdAt:'asc'},take:20});
 for(const row of commands){
  await db.lineOaBrowserCommand.delete({where:{id:row.id}});
  if(Date.now()-row.createdAt.getTime()>60000)continue;
  const command=oaCommand.parse(unsealOaState(row.encryptedPayload));
  if(command.action==='click')await login.page.mouse.click(command.x,command.y);
  if(command.action==='type')await login.page.keyboard.insertText(command.text);
  if(command.action==='key')await login.page.keyboard.press(command.key);
  if(command.action==='scroll')await login.page.mouse.wheel(0,command.y);
  if(command.action==='verify'){
   try{await verifyManager(login.page,connection.account);}catch{continue;}
   const accounts=await discoverOaAccounts(login.page);await saveOaAccounts(accounts);
   const state=await login.context.storageState({indexedDB:true});
   await db.lineOaBrowser.update({where:{id:'active'},data:{encryptedConfig:sealOaState(state),status:'READY',sessionId:null,screenshotData:null,sessionExpiresAt:null}});
   await db.lineOaJob.updateMany({where:{account:{in:accounts.map(account=>account.account)},status:'AWAITING_LOGIN'},data:{status:'QUEUED',error:null}});
   await db.lineOaBrowserCommand.deleteMany({where:{sessionId:login.id}});
   await login.context.close();login=undefined;return true;
  }
 }
 if(login){const image=await login.page.screenshot({type:'jpeg',quality:65});await db.lineOaBrowser.update({where:{id:'active'},data:{screenshotData:Buffer.from(sealOaState({base64:image.toString('base64')})),heartbeatAt:new Date()}});}
 return true;
}
async function accountDiscoveryStep(){
 const connection=await db.lineOaBrowser.findUnique({where:{id:'active'}});
 if(!connection||connection.status!=='DISCOVER_REQUESTED')return false;
 await db.lineOaBrowser.update({where:{id:'active'},data:{leaseUntil:new Date(Date.now()+180000),heartbeatAt:new Date()}});
 let context:Awaited<ReturnType<typeof openPage>>|undefined;
 try{
  context=await openPage();await saveOaAccounts(await discoverOaAccounts(context.page));
  await db.lineOaBrowser.update({where:{id:'active'},data:{status:'READY',accountsError:null}});
 }catch(error){
  const expired=error instanceof Error&&error.message==='OA_LOGIN_REQUIRED';
  await db.lineOaBrowser.update({where:{id:'active'},data:{status:expired?'EXPIRED':'READY',accountsError:expired?'การล็อกอินหมดอายุ กรุณาเชื่อม LINE OA ใหม่':'โหลดรายชื่อ OA ไม่สำเร็จ กรุณาลองใหม่'}});
 }finally{
  if(context)await context.close().catch(()=>{});
  await db.lineOaBrowser.update({where:{id:'active'},data:{leaseUntil:null,heartbeatAt:new Date()}});
 }
 return true;
}
process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
try{while(!stopping){try{if(await accountDiscoveryStep())continue;if(await loginStep()){await sleep(1500);continue;}if(await runOaWorkBatch(createWorkSession,processOaStep))continue;}catch{console.error('LINE OA worker paused after a failed operation');}await sleep(5000);}}
finally{if(login)await login.context.close().catch(()=>{});await browser.close();await db.$disconnect();}
}
void main().catch(()=>{console.error('LINE OA worker could not start');process.exitCode=1;});
