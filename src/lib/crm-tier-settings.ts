import {transaction,userLock} from './db';
import {defaultTierSettings} from './crm-tiers';
import {resolveTierRules,tierRuleSchema} from './crm-tier-rules';
export async function saveTierRule(actor:string,input:unknown){
 const rule={...tierRuleSchema.parse(input),match:'all' as const};
 return transaction(async tx=>{
  await userLock(tx,'crm-tier-settings');
  const previous=await tx.crmTierSettings.findUnique({where:{id:'default'}});
  const rules=resolveTierRules(previous??defaultTierSettings).map(r=>r.tier===rule.tier?rule:r);
  await tx.crmTierSettings.upsert({where:{id:'default'},create:{id:'default',...defaultTierSettings,rules},update:{rules}});
  await tx.auditLog.create({data:{actor,action:'CRM_TIER_RULE_UPDATED',entityId:rule.tier,details:{before:previous?.rules??null,rule}}});
  return rule;
 });
}
