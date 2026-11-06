import type {Prisma} from '@prisma/client';
import {userLock} from './db';
import {loadCustomerCrm,customerLifetimeStats} from './customer-crm';
import {assignCustomerTiers,defaultTierSettings} from './crm-tiers';
import {resolveTierRules,matchesTierRule,tierNames,type TierMetricValues} from './crm-tier-rules';
import {membershipDecision} from './crm-membership-decision';
import {bangkokDay,dayStart,shiftMonth} from './sales-dates';

export function tierMetrics(summary:Awaited<ReturnType<typeof loadCustomerCrm>> extends Map<string,infer V>?V:never,createdAt:Date,at:Date){
 const life=customerLifetimeStats(summary,createdAt,at);
 return {purchasedSatang:life.purchasedSatang,profit:life.pendingCostCount?null:life.profitSatang/100,monthlySpend:life.monthlyAverageSatang/100,frequency:life.monthlyOrderAverage,gap:life.averageGapDays,points:summary.allHistory.reduce((n,h)=>n+h.points,0),purchases:life.purchaseCount,monthlyProfit:life.currentMonthProfitSatang===null?null:life.currentMonthProfitSatang/100,monthlySpendActual:life.currentMonthSpentSatang/100,monthlyPurchases:life.currentMonthPurchases,membershipDays:life.days};
}
export async function ensureMonthlyMemberships(tx:Prisma.TransactionClient,at=new Date()){
 const month=bangkokDay(at).slice(0,7);
 const customers=await tx.customer.findMany({where:{OR:[{conversionId:null},{conversion:{source:'LINE'}}]},select:{code:true,createdAt:true}});
 const codes=customers.map(c=>c.code);
 let current=await tx.crmMembershipReview.findMany({where:{month,customerCode:{in:codes}}});
 if(current.length===customers.length)return new Map(current.map(r=>[r.customerCode,r]));
 await userLock(tx,'crm-monthly-membership');
 const reviews=await tx.crmMembershipReview.findMany({where:{customerCode:{in:codes},month:{lte:month}},orderBy:{month:'desc'}});
 const latest=new Map<string,(typeof reviews)[number]>();for(const review of reviews)if(!latest.has(review.customerCode))latest.set(review.customerCode,review);
 const settings=await tx.crmTierSettings.findUnique({where:{id:'default'}})??defaultTierSettings,rules=resolveTierRules(settings);
 const summaries=await loadCustomerCrm(codes,undefined,tx);
 const records:Prisma.CrmMembershipReviewCreateManyInput[]=[];
 const cache=new Map<string,{metrics:Map<string,ReturnType<typeof tierMetrics>>;tiers:ReturnType<typeof assignCustomerTiers>}>();
 const evaluation=(assignedMonth:string)=>{
  const end=new Date(+dayStart(assignedMonth+'-01')-1);
  const metrics=new Map(customers.map(c=>{
   const base=summaries.get(c.code)!;
   const history=base.allHistory.filter(h=>h.order.eventAt<=end).map(h=>h.recognized&&h.recognizedAt&&h.recognizedAt<=end?{...h,order:{...h.order,eventAt:h.recognizedAt}}:{...h,recognized:false,points:0,profitSatang:null});
   return [c.code,tierMetrics({...base,allHistory:history},c.createdAt,end)] as const;
  }));
  const tiers=assignCustomerTiers([...metrics].map(([code,m])=>({code,...m})),settings);
  return {metrics,tiers};
 };
 const initial=evaluation(month);cache.set(month,initial);
 for(const c of customers){
  let previous=latest.get(c.code);
  if(!previous){
   records.push({customerCode:c.code,month,assessedMonth:shiftMonth(month+'-01',-1).slice(0,7),level:initial.tiers.get(c.code)?.name??'ลูกค้าใหม่',failedMonths:0,decision:'INITIAL',metrics:{}});continue;
  }
  let next=shiftMonth(previous.month+'-01',1).slice(0,7);
  while(next<=month){
   if(!cache.has(next))cache.set(next,evaluation(next));
   const {metrics,tiers}=cache.get(next)!,m=metrics.get(c.code)!,qualified=tiers.get(c.code)!;
   const rule=rules.find(r=>tierNames[r.tier]===previous!.level);
   const values:TierMetricValues={...m,spend:m.purchasedSatang/100,topPercent:qualified.rank?(qualified.rank-1)/Math.max(1,qualified.buyers)*100:100};
   const decided=membershipDecision(previous,qualified.name,!!rule&&matchesTierRule(rule,values),m.monthlyProfit===null);
   const row={customerCode:c.code,month:next,assessedMonth:shiftMonth(next+'-01',-1).slice(0,7),...decided,metrics:{monthlySpend:m.monthlySpendActual,monthlyProfit:m.monthlyProfit,monthlyPurchases:m.monthlyPurchases,membershipDays:m.membershipDays}};
   records.push(row);previous={...previous,...row};next=shiftMonth(next+'-01',1).slice(0,7);
  }
 }
 if(records.length)await tx.crmMembershipReview.createMany({data:records,skipDuplicates:true});
 current=await tx.crmMembershipReview.findMany({where:{month,customerCode:{in:codes}}});
 return new Map(current.map(r=>[r.customerCode,r]));
}
