import {db} from './db';
import {loadCustomerCrm,customerLifetimeStats} from './customer-crm';
import {assignCustomerTiers,defaultTierSettings} from './crm-tiers';
export async function crmTierReport(){
 const [customers,saved]=await Promise.all([db.customer.findMany({where:{OR:[{conversionId:null},{conversion:{source:'LINE'}}]},select:{code:true,createdAt:true}}),db.crmTierSettings.findUnique({where:{id:'default'}})]);
 const summaries=await loadCustomerCrm(customers.map(c=>c.code)),settings=saved??defaultTierSettings;
 const tiers=assignCustomerTiers(customers.map(c=>{const s=summaries.get(c.code)!,life=customerLifetimeStats(s,c.createdAt);return {code:c.code,purchasedSatang:life.purchasedSatang,profit:life.pendingCostCount?null:life.profitSatang/100,monthlySpend:life.monthlyAverageSatang/100,frequency:life.monthlyOrderAverage,gap:life.averageGapDays,points:s.lifetimePoints,purchases:life.purchaseCount,monthlyProfit:life.currentMonthProfitSatang===null?null:life.currentMonthProfitSatang/100,monthlySpendActual:life.currentMonthSpentSatang/100,monthlyPurchases:life.currentMonthPurchases,membershipDays:life.days};}),settings);
 return {settings,tiers,summaries};
}
