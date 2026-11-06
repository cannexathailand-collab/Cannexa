import type {Prisma} from '@prisma/client';
import {userLock} from './db';
import {crmTierReport} from './crm-tier-report';
import {pointTierKey,tierPointRatesSchema,type TierPointSnapshot} from './crm-tier-points';
export async function capturePointSnapshot(tx:Prisma.TransactionClient,customerCode:string|null,at:Date):Promise<TierPointSnapshot|null>{
 const rule=await tx.crmPointRule.findFirst({where:{effectiveAt:{lte:at}},orderBy:{effectiveAt:'desc'}});
 if(!rule?.tierRates)return null;
 const rates=tierPointRatesSchema.parse(rule.tierRates);
 let tier:keyof typeof rates='new';
 if(rule.enabled&&customerCode){
  await userLock(tx,'crm-loyalty:'+customerCode);
  const report=await crmTierReport(tx,at);
  tier=pointTierKey(report.tiers.get(customerCode)?.name??'ลูกค้าใหม่');
 }
 return {version:1,ruleId:rule.id,enabled:rule.enabled,tier,pointsPerThousand:rates[tier]};
}
