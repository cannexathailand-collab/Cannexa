import {db,transaction} from './db';
import type {Prisma} from '@prisma/client';
import {loadCustomerCrm,customerLifetimeStats} from './customer-crm';
import {assignCustomerTiers,defaultTierSettings} from './crm-tiers';
import {ensureMonthlyMemberships} from './crm-membership-monthly';
async function report(client:Prisma.TransactionClient,at:Date){
 const reviews=await ensureMonthlyMemberships(client,at);
 const [customers,saved]=await Promise.all([client.customer.findMany({where:{OR:[{conversionId:null},{conversion:{source:'LINE'}}]},select:{code:true,createdAt:true}}),client.crmTierSettings.findUnique({where:{id:'default'}})]);
 const summaries=await loadCustomerCrm(customers.map(c=>c.code),undefined,client),settings=saved??defaultTierSettings;
 const tiers=assignCustomerTiers(customers.map(c=>{const s=summaries.get(c.code)!,life=customerLifetimeStats(s,c.createdAt);return {code:c.code,purchasedSatang:life.purchasedSatang,profit:life.pendingCostCount?null:life.profitSatang/100,monthlySpend:life.monthlyAverageSatang/100,frequency:life.monthlyOrderAverage,gap:life.averageGapDays,points:s.lifetimePoints,purchases:life.purchaseCount,monthlyProfit:life.currentMonthProfitSatang===null?null:life.currentMonthProfitSatang/100,monthlySpendActual:life.currentMonthSpentSatang/100,monthlyPurchases:life.currentMonthPurchases,membershipDays:life.days};}),settings);
 const fixedTiers=new Map([...tiers].map(([code,tier])=>{const review=reviews.get(code);return [code,{...tier,name:review?.level??'ลูกค้าใหม่',reviewMonth:review?.month??'',assessedMonth:review?.assessedMonth??'',failedMonths:review?.failedMonths??0,decision:review?.decision??'INITIAL'}] as const;}));
 return {settings,tiers:fixedTiers,summaries};
}
export async function crmTierReport(client:Prisma.TransactionClient=db,at=new Date()){return client===db?transaction(tx=>report(tx,at)):report(client,at);}
