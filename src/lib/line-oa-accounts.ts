import {z} from 'zod';
import type {Page} from 'playwright-core';
import {db,transaction,userLock} from './db';

export const oaAccountId=z.string().regex(/^@[a-zA-Z0-9._-]{1,100}$/);
export type OaTarget={account:string;name:string;available:boolean};
export function parseOaAccountLink(href:string,name:string){
 const url=new URL(href,'https://manager.line.biz');
 const account=url.pathname.match(/^\/account\/(@[a-zA-Z0-9._-]+)\/?$/)?.[1];
 if(url.origin!=='https://manager.line.biz'||!account||!oaAccountId.safeParse(account).success||!name.trim())return null;
 return {account,name:name.trim().slice(0,200)};
}
export function chooseOaTarget(requested:string|undefined,primary:string,targets:OaTarget[],canChooseOther:boolean){
 const account=oaAccountId.parse(requested??primary);
 if(account!==primary&&!canChooseOther)throw Error('OA_TARGET_FORBIDDEN');
 if(!targets.some(target=>target.account===account&&target.available))throw Error('OA_TARGET_UNAVAILABLE');
 return account;
}
export async function availableOaTargets(){
 const [connection,accounts]=await Promise.all([
  db.lineOaBrowser.findUnique({where:{id:'active'},select:{account:true,status:true,accountsUpdatedAt:true,accountsError:true}}),
  db.lineOaAccount.findMany({where:{available:true},orderBy:{name:'asc'},select:{account:true,name:true,available:true}}),
 ]);
 return {connection,accounts};
}
export async function requestOaAccountRefresh(actor:string){
 await transaction(async tx=>{
  await userLock(tx,'line-oa-browser-login');
  const connection=await tx.lineOaBrowser.findUnique({where:{id:'active'}});
  if(!connection||connection.status!=='READY')throw Error('OA_LOGIN_REQUIRED');
  if(connection.leaseUntil&&connection.leaseUntil>new Date())throw Error('OA_BUSY');
  await tx.lineOaBrowser.update({where:{id:'active'},data:{status:'DISCOVER_REQUESTED',accountsError:null}});
  await tx.auditLog.create({data:{actor,action:'LINE_OA_ACCOUNTS_REFRESH_REQUESTED',entityId:'active',details:{}}});
 });
}
export async function saveOaAccounts(accounts:{account:string;name:string}[]){
 if(!accounts.length)throw Error('OA_ACCOUNTS_EMPTY');
 const verifiedAt=new Date();
 await transaction(async tx=>{
  await tx.lineOaAccount.updateMany({data:{available:false}});
  for(const account of accounts)await tx.lineOaAccount.upsert({where:{account:account.account},create:{...account,available:true,verifiedAt},update:{name:account.name,available:true,verifiedAt}});
  await tx.lineOaBrowser.update({where:{id:'active'},data:{accountsUpdatedAt:verifiedAt,accountsError:null}});
 });
}
export async function discoverOaAccounts(page:Page){
 await page.goto('https://manager.line.biz/',{waitUntil:'domcontentloaded'});
 if(!await page.getByRole('heading',{name:'รายชื่อบัญชี',exact:true}).waitFor({state:'visible',timeout:20000}).then(()=>true,()=>false))throw Error('OA_LOGIN_REQUIRED');
 const targets=new Map<string,{account:string;name:string}>(),seen=new Set<string>();
 const links=page.locator('main table a[href^="/account/"]');
 for(let number=0;number<100;number++){
  await links.first().waitFor({state:'attached',timeout:15000});
  const rows=await links.evaluateAll(elements=>elements.map(element=>({href:element.getAttribute('href')??'',name:element.textContent??''})));
  const signature=JSON.stringify(rows);
  if(seen.has(signature))throw Error('OA_ACCOUNTS_PAGINATION');seen.add(signature);
  for(const row of rows){const target=parseOaAccountLink(row.href,row.name);if(target)targets.set(target.account,target);}
  const next=page.getByRole('link',{name:'Next',exact:true});
  const disabled=!await next.count()||await next.evaluate(element=>element.getAttribute('aria-disabled')==='true'||!!element.closest('.disabled'));
  if(disabled){
   const headings=await page.getByRole('heading').allTextContents();
   const expected=headings.map(text=>text.match(/^บัญชี\((\d+)\)$/)?.[1]).find(Boolean);
   if(expected&&targets.size!==Number(expected))throw Error('OA_ACCOUNTS_INCOMPLETE');
   return [...targets.values()];
  }
  await next.click();
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
   const current=await links.evaluateAll(elements=>elements.map(element=>({href:element.getAttribute('href')??'',name:element.textContent??''})));
   if(current.length&&JSON.stringify(current)!==signature)break;
   await page.waitForTimeout(100);
  }
 }
 throw Error('OA_ACCOUNTS_LIMIT');
}
