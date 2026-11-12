import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
import {z} from 'zod';
import {db} from './db';
import {env} from './config';
export const openAiInput=z.object({key:z.string().trim().min(20).max(1024).startsWith('sk-'),model:z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9._:-]+$/)});
function encryptionKey(){return createHmac('sha256',env('SESSION_SECRET')).update('cannexa/openai/v1').digest();}
export function sealOpenAiKey(value:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url');}
export function unsealOpenAiKey(value:string){const data=Buffer.from(value,'base64url'),cipher=createDecipheriv('aes-256-gcm',encryptionKey(),data.subarray(0,12));cipher.setAuthTag(data.subarray(12,28));return Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString('utf8');}
export async function saveOpenAiConnection(actor:string,value:unknown){
 const input=openAiInput.parse(value);
 const response=await fetch('https://api.openai.com/v1/models',{headers:{Authorization:'Bearer '+input.key},signal:AbortSignal.timeout(15000),cache:'no-store'});
 if(!response.ok)throw Error('OPENAI_KEY_REJECTED');
 const models=await response.json();if(!Array.isArray(models.data)||!models.data.some((m:{id?:string})=>m.id===input.model))throw Error('OPENAI_MODEL_UNAVAILABLE');
 await db.$transaction(async tx=>{
  const data={encryptedKey:sealOpenAiKey(input.key),model:input.model};
  await tx.openAiConnection.upsert({where:{id:'active'},create:{id:'active',...data},update:data});
  await tx.auditLog.create({data:{actor,action:'OPENAI_CONNECTION_UPDATED',entityId:'active',details:{model:input.model}}});
 });
}
