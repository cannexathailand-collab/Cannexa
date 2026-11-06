import {transaction,userLock} from './db';
import {pointTierKeys,tierPointRatesSchema,type TierPointRates} from './crm-tier-points';
export async function saveCrmPointRule(actor:string,enabled:boolean,satangPerPoint:number,tierRates?:TierPointRates){
 if(!Number.isSafeInteger(satangPerPoint)||satangPerPoint<1||satangPerPoint>2147483647)throw Error('INVALID_RATE');
 const rates=tierRates?tierPointRatesSchema.parse(tierRates):undefined;
 return transaction(async tx=>{
  await userLock(tx,'crm-points');
  const previous=await tx.crmPointRule.findFirst({orderBy:{effectiveAt:'desc'}});
  const oldRates=tierPointRatesSchema.safeParse(previous?.tierRates),sameRates=rates?oldRates.success&&pointTierKeys.every(key=>oldRates.data[key]===rates[key]):previous?.tierRates==null;
  if(previous?.enabled===enabled&&previous.satangPerPoint===satangPerPoint&&sameRates)return previous;
  const row=await tx.crmPointRule.create({data:{enabled,satangPerPoint,tierRates:rates,createdBy:actor}});
  await tx.auditLog.create({data:{actor,action:'CRM_POINT_RULE_CHANGED',entityId:row.id,details:{enabled,satangPerPoint,tierRates:rates??null,effectiveAt:row.effectiveAt.toISOString()}}});
  return row;
 });
}
