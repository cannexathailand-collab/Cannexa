import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
import {db} from './db';
import {env} from './config';

function encryptionKey(){
 return createHmac('sha256',env('SESSION_SECRET')).update('cannexa/line-message-recipient/v1').digest();
}

export function encryptLineRecipient(userId:string,botId:string,lineUserKey:string){
 const iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
 cipher.setAAD(Buffer.from(JSON.stringify([botId,lineUserKey])));
 const encrypted=Buffer.concat([cipher.update(userId,'utf8'),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
}

export function decryptLineRecipient(encrypted:string,botId:string,lineUserKey:string){
 const data=Buffer.from(encrypted,'base64url');
 const cipher=createDecipheriv('aes-256-gcm',encryptionKey(),data.subarray(0,12));
 cipher.setAAD(Buffer.from(JSON.stringify([botId,lineUserKey])));
 cipher.setAuthTag(data.subarray(12,28));
 return Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString('utf8');
}

export async function saveLineMessageRecipient(lineUserKey:string,botId:string,userId:string){
 const encryptedUserId=encryptLineRecipient(userId,botId,lineUserKey);
 await db.lineMessageRecipient.upsert({where:{lineUserKey},create:{lineUserKey,botId,encryptedUserId},update:{botId,encryptedUserId}});
}
