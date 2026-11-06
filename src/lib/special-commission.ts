import {z} from 'zod';
import {transaction,userLock} from './db';
import {bangkokDay,dayStart} from './sales-dates';
import {metaAdCode} from './meta-ad';
const input=z.object({affiliateId:z.string().min(1).max(100),requestKey:z.string().uuid(),amountSatang:z.number().int().positive().max(2147483647),reason:z.string().trim().min(1).max(500),day:z.string(),confirmed:z.literal(true)});
export async function recordSpecialCommission(actor:string,value:unknown){
 const p=input.parse(value),paidAt=dayStart(p.day);if(p.day<'2000-01-01'||p.day>bangkokDay(new Date()))throw Error('INVALID_PAYMENT_DATE');
 return transaction(async tx=>{
  await userLock(tx,'commission-payout:'+p.affiliateId);
  const existing=await tx.specialCommission.findUnique({where:{requestKey:p.requestKey}});
  if(existing){if(existing.affiliateId!==p.affiliateId||existing.amountSatang!==p.amountSatang||existing.reason!==p.reason||+existing.paidAt!==+paidAt)throw Error('PAYMENT_REQUEST_CHANGED');return existing;}
  const affiliate=await tx.affiliate.findUnique({where:{id:p.affiliateId}});if(!affiliate||affiliate.code===metaAdCode)throw Error('AFFILIATE_NOT_FOUND');
  const row=await tx.specialCommission.create({data:{requestKey:p.requestKey,affiliateId:p.affiliateId,amountSatang:p.amountSatang,reason:p.reason,paidAt,createdBy:actor}});
  await tx.auditLog.create({data:{actor,action:'COMMISSION_PAID_BATCH',entityId:p.affiliateId,details:{specialIds:[row.id],amountSatang:row.amountSatang,paidAt:paidAt.toISOString(),items:[{label:'ค่าคอมพิเศษ',recipient:affiliate.name,reference:row.reason,amountSatang:row.amountSatang}]}}});
  return row;
 });
}
