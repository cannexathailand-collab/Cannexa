import {randomUUID} from 'node:crypto';
import type {Prisma} from '@prisma/client';
import {z} from 'zod';
import {db,transaction,userLock} from './db';

const inputSchema=z.object({closeTime:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),expectedVersion:z.uuid().nullable()});
export async function loadOrderRoundSettings(client:Prisma.TransactionClient=db){
 const saved=await client.orderRoundSettings.findUnique({where:{id:'active'}});
 const closeMinutes=saved?.closeMinutes??720;
 return {closeMinutes,closeTime:String(Math.floor(closeMinutes/60)).padStart(2,'0')+':'+String(closeMinutes%60).padStart(2,'0'),version:saved?.version??null};
}
export async function saveOrderRoundSettings(actor:string,value:unknown){
 const parsed=inputSchema.safeParse(value);if(!parsed.success)throw Error('กรุณาเลือกเวลาปิดรอบให้ถูกต้อง');
 const [hour,minute]=parsed.data.closeTime.split(':').map(Number),closeMinutes=hour*60+minute;
 return transaction(async tx=>{
  await userLock(tx,'order-round-settings');
  const previous=await loadOrderRoundSettings(tx);
  if(previous.closeMinutes===closeMinutes)return previous;
  if(previous.version!==parsed.data.expectedVersion)throw Error('เวลาปิดรอบมีการแก้ไขแล้ว กรุณาโหลดหน้าใหม่ก่อนบันทึก');
  const version=randomUUID();
  await tx.orderRoundSettings.upsert({where:{id:'active'},create:{id:'active',closeMinutes,version},update:{closeMinutes,version}});
  await tx.auditLog.create({data:{actor,action:'ORDER_ROUND_SETTINGS_UPDATED',entityId:'active',details:{before:{closeTime:previous.closeTime},after:{closeTime:parsed.data.closeTime}}}});
  return {closeMinutes,closeTime:parsed.data.closeTime,version};
 });
}
