import type {PrismaClient} from '@prisma/client';
import {loadCustomerCrm,customerLifetimeStats} from './customer-crm';
import {customerAddress} from './customer-address';
import {customerOrderRecency} from './crm-customer-recency';

export async function platformCustomerData(client:PrismaClient,now=new Date()){
 const customers=await client.customer.findMany({select:{code:true,name:true,phone:true,address:true,createdAt:true}});
 const summaries=await loadCustomerCrm(customers.map(customer=>customer.code),undefined,client);
 return customers.map(customer=>{
  const summary=summaries.get(customer.code)!;
  const lifetime=customerLifetimeStats(summary,customer.createdAt,now);
  const recency=customerOrderRecency(summary.allHistory,now);
  const resolvedAddress=customerAddress(customer.address,summary.allHistory.map(row=>row.order));
  return {
   createdAt:customer.createdAt.toISOString(),addressSource:resolvedAddress.source,
   code:customer.code,name:customer.name,phone:customer.phone,address:resolvedAddress.address,
   orderCount:summary.orderCount,purchaseCount:summary.purchaseCount,orderedSatang:summary.orderedSatang,
   purchasedSatang:summary.purchasedSatang,pendingSatang:summary.pendingSatang,
   knownProfitSatang:summary.profitSatang,profitSatang:summary.pendingCostCount?null:summary.profitSatang,pendingCostCount:summary.pendingCostCount,
   monthlyProfitAverageSatang:lifetime.monthlyProfitAverageSatang,monthlyAverageSatang:lifetime.monthlyAverageSatang,
   averageOrderSatang:lifetime.averageOrderSatang,lastOrderAt:recency.lastOrderAt?.toISOString()??null,
   lastPurchaseAt:lifetime.lastPurchaseAt?.toISOString()??null,daysSinceLastOrder:recency.daysSinceLastOrder,
   inactive:recency.inactiveThreeMonths,returnedCount:summary.returnedCount,unknownAmountCount:summary.unknownAmountCount,
  };
 }).sort((a,b)=>b.orderCount-a.orderCount||b.purchasedSatang-a.purchasedSatang||a.code.localeCompare(b.code));
}
export type PlatformCustomerRow=Awaited<ReturnType<typeof platformCustomerData>>[number];
