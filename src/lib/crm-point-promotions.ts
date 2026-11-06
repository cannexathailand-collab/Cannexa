import {z} from 'zod';
import {transaction} from './db';
import {dayStart,shiftDay} from './sales-dates';
export const promotionSnapshotSchema=z.object({id:z.string(),name:z.string(),minimumSatang:z.number().int().positive(),bonusType:z.enum(['POINTS','PERCENT']),bonusValue:z.number().int().positive().max(1000000)});
export type PromotionSnapshot=z.infer<typeof promotionSnapshotSchema>;
export function promotionBonus(revenueSatang:number,basePoints:number,promotions:PromotionSnapshot[]){return promotions.reduce((best,p)=>revenueSatang>=p.minimumSatang?Math.max(best,p.bonusType==='PERCENT'?Math.floor(basePoints*p.bonusValue/100):p.bonusValue):best,0);}
const input=z.object({id:z.string().min(1).max(100).optional(),requestKey:z.string().min(16).max(100),name:z.string().trim().min(1).max(120),enabled:z.boolean(),from:z.string(),to:z.string(),minimumSatang:z.number().int().positive().max(2147483647),bonusType:z.enum(['POINTS','PERCENT']),bonusValue:z.number().int().positive().max(1000000)}).refine(p=>p.bonusType!=='PERCENT'||p.bonusValue<=1000);
export async function savePointPromotion(actor:string,value:unknown){
 const parsed=input.parse(value),startsAt=dayStart(parsed.from),endsAt=dayStart(shiftDay(parsed.to,1));
 if(startsAt>=endsAt)throw Error('INVALID_PROMOTION_DATES');
 const data={name:parsed.name,enabled:parsed.enabled,startsAt,endsAt,minimumSatang:parsed.minimumSatang,bonusType:parsed.bonusType,bonusValue:parsed.bonusValue};
 return transaction(async tx=>{
  const row=parsed.id?await tx.crmPointPromotion.update({where:{id:parsed.id},data}):await tx.crmPointPromotion.upsert({where:{requestKey:parsed.requestKey},create:{requestKey:parsed.requestKey,...data},update:{}});
  await tx.auditLog.create({data:{actor,action:'CRM_POINT_PROMOTION_SAVED',entityId:row.id,details:{...data,startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString()}}});
  return row;
 });
}
