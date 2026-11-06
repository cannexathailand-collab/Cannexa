import {matchesTierRule,resolveTierRules,tierNames,type TierMetricValues} from './crm-tier-rules';
export const defaultTierSettings={vipTopPercent:20,goldTopPercent:40,silverTopPercent:70};
export type TierSettings=typeof defaultTierSettings&{rules?:unknown};
export function validTierSettings(s:TierSettings){return [s.vipTopPercent,s.goldTopPercent,s.silverTopPercent].every(Number.isInteger)&&s.vipTopPercent>0&&s.vipTopPercent<s.goldTopPercent&&s.goldTopPercent<s.silverTopPercent&&s.silverTopPercent<100;}
export function assignCustomerTiers(customers:({code:string;purchasedSatang:number}&Partial<Omit<TierMetricValues,'spend'|'topPercent'>>)[],settings:TierSettings=defaultTierSettings){
 if(!validTierSettings(settings))throw Error('INVALID_TIER_THRESHOLDS');
 const rules=resolveTierRules(settings);
 const unique=[...new Map(customers.map(c=>[c.code,c])).values()],buyers=unique.filter(c=>c.purchasedSatang>0).sort((a,b)=>b.purchasedSatang-a.purchasedSatang);
 const result=new Map(unique.map(c=>[c.code,{name:'ลูกค้าใหม่',rank:null as number|null,buyers:buyers.length}]));
 let previous=-1,rank=0;
 buyers.forEach((c,index)=>{
  if(c.purchasedSatang!==previous)rank=index;
  previous=c.purchasedSatang;const topPercent=rank/buyers.length*100;
  const values:TierMetricValues={spend:c.purchasedSatang/100,profit:c.profit??null,monthlyProfit:c.monthlyProfit??null,monthlySpend:c.monthlySpend??0,frequency:c.frequency??0,gap:c.gap??null,points:c.points??0,purchases:c.purchases??0,monthlySpendActual:c.monthlySpendActual??0,monthlyPurchases:c.monthlyPurchases??0,membershipDays:c.membershipDays??0,topPercent};
  const matched=['vip','gold','silver','bronze'].map(tier=>rules.find(r=>r.tier===tier)!).find(r=>matchesTierRule(r,values));
  const name=matched?tierNames[matched.tier]:'ยังไม่เข้าเกณฑ์';
  result.set(c.code,{name,rank:rank+1,buyers:buyers.length});
 });
 return result;
}
