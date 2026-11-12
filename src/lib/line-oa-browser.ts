import {createCipheriv,createDecipheriv,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db,transaction,userLock} from './db';
import {env} from './config';
import {lineSettings} from './line-settings';

function key(){return createHmac('sha256',env('SESSION_SECRET')).update('cannexa/line-oa-browser/v1').digest();}
export function sealOaState(value:unknown){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url');}
export function unsealOaState(value:string){const data=Buffer.from(value,'base64url'),cipher=createDecipheriv('aes-256-gcm',key(),data.subarray(0,12));cipher.setAuthTag(data.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString('utf8'));}
export const oaCommand=z.discriminatedUnion('action',[
 z.object({action:z.literal('click'),x:z.number().int().min(0).max(1279),y:z.number().int().min(0).max(899)}),
 z.object({action:z.literal('type'),text:z.string().min(1).max(1000)}),
 z.object({action:z.literal('key'),key:z.enum(['Enter','Tab','Backspace','Escape','ControlOrMeta+A'])}),
 z.object({action:z.literal('scroll'),y:z.number().int().min(-900).max(900)}),
 z.object({action:z.literal('verify')}),
]);
export async function startOaLogin(actor:string){
 const line=await lineSettings();if(!line||!/^@[a-zA-Z0-9._-]+$/.test(line.settings.basicId))throw Error('OA_NOT_CONNECTED');
 return transaction(async tx=>{
  await userLock(tx,'line-oa-browser-login');const old=await tx.lineOaBrowser.findUnique({where:{id:'active'}});
  if(old?.leaseUntil&&old.leaseUntil>new Date())throw Error('OA_BUSY');
  await tx.lineOaAccount.updateMany({data:{available:false}});
  await tx.lineOaBrowserCommand.deleteMany({});
  const data={account:line.settings.basicId,status:'LOGIN_REQUESTED',sessionId:randomUUID(),sessionExpiresAt:new Date(Date.now()+10*60000),screenshotData:null,accountsError:null};
  await tx.lineOaBrowser.upsert({where:{id:'active'},create:{id:'active',encryptedConfig:sealOaState({}),...data},update:{...data,...(old?.account!==line.settings.basicId?{encryptedConfig:sealOaState({})}:{})}});
  await tx.auditLog.create({data:{actor,action:'LINE_OA_LOGIN_REQUESTED',entityId:'active',details:{account:line.settings.basicId}}});
 });
}
export async function enqueueOaCommand(value:unknown){
 const input=z.object({sessionId:z.string().uuid(),command:oaCommand}).parse(value);
 const browser=await db.lineOaBrowser.findUnique({where:{id:'active'}});
 if(!browser||browser.sessionId!==input.sessionId||!browser.sessionExpiresAt||browser.sessionExpiresAt<new Date()||!['LOGIN_REQUESTED','AWAITING_LOGIN'].includes(browser.status))throw Error('OA_LOGIN_EXPIRED');
 const count=await db.lineOaBrowserCommand.count({where:{sessionId:input.sessionId}});if(count>=30)throw Error('OA_BUSY');
 await db.lineOaBrowserCommand.create({data:{sessionId:input.sessionId,encryptedPayload:sealOaState(input.command)}});
}
