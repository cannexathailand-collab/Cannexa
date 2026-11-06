import {transaction,userLock} from './db';
export async function saveCrmPointRule(actor:string,enabled:boolean,satangPerPoint:number){
 if(!Number.isSafeInteger(satangPerPoint)||satangPerPoint<1||satangPerPoint>2147483647)throw Error('INVALID_RATE');
 return transaction(async tx=>{
  await userLock(tx,'crm-points');
  const previous=await tx.crmPointRule.findFirst({orderBy:{effectiveAt:'desc'}});
  if(previous?.enabled===enabled&&previous.satangPerPoint===satangPerPoint)return previous;
  const row=await tx.crmPointRule.create({data:{enabled,satangPerPoint,createdBy:actor}});
  await tx.auditLog.create({data:{actor,action:'CRM_POINT_RULE_CHANGED',entityId:row.id,details:{enabled,satangPerPoint,effectiveAt:row.effectiveAt.toISOString()}}});
  return row;
 });
}
