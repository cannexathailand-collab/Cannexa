import type {PrismaClient} from '@prisma/client';
import {loadCustomerCrm,customerLifetimeStats} from './customer-crm';
import {customerAddress} from './customer-address';
import {customerOrderRecency} from './crm-customer-recency';
import {withDatabase} from './db';
import {readStockSheet} from './stock-google';
import {pendingOrderProfit} from './pending-order-profit';

export async function platformCustomerData(client:PrismaClient,now=new Date(),customerCode?:string){
 const customers=await client.customer.findMany({where:customerCode?{code:customerCode}:undefined,select:{code:true,name:true,phone:true,address:true,createdAt:true}});
 const summaries=await loadCustomerCrm(customers.map(customer=>customer.code),undefined,client);
 const needsUnitCosts=[...summaries.values()].some(summary=>summary.allHistory.some(row=>!row.excluded&&!row.recognized&&row.productCostSatang===null));
 const stock=needsUnitCosts?await withDatabase(client,()=>readStockSheet().catch(()=>null)):null;
 const unitCosts=new Map(stock?.products.map(product=>[product.code,product.costSatang])??[]);
 return customers.map(customer=>{
  const summary=summaries.get(customer.code)!;
  const lifetime=customerLifetimeStats(summary,customer.createdAt,now);
  const pendingCod=pendingOrderProfit(summary.allHistory,unitCosts);
  const unshippedTransfers=pendingOrderProfit(summary.allHistory,unitCosts,'โอน');
  const receivedSatang=summary.purchasedSatang+unshippedTransfers.revenueSatang;
  const receivedProfit=summary.profitSatang+unshippedTransfers.knownProfitSatang;
  const receivedMissingCosts=summary.pendingCostCount+unshippedTransfers.missingCount;
  const receivedCount=summary.purchaseCount+unshippedTransfers.count;
  const latestReceived=summary.allHistory.find(row=>!row.excluded&&(row.recognized||row.order.payment==='โอน'));
  const recency=customerOrderRecency(summary.allHistory,now);
  const resolvedAddress=customerAddress(customer.address,summary.allHistory.map(row=>row.order));
  return {
   createdAt:customer.createdAt.toISOString(),addressSource:resolvedAddress.source,
   code:customer.code,name:customer.name,phone:customer.phone,address:resolvedAddress.address,
   orderCount:summary.orderCount,purchaseCount:receivedCount,orderedSatang:summary.orderedSatang,
   purchasedSatang:receivedSatang,pendingSatang:pendingCod.revenueSatang,
   knownProfitSatang:receivedProfit,profitSatang:receivedMissingCosts?null:receivedProfit,pendingCostCount:receivedMissingCosts,
   pendingCod,receivedEstimatedCostCount:unshippedTransfers.estimatedCostCount,
   monthlyProfitAverageSatang:receivedMissingCosts?null:Math.round(receivedProfit/lifetime.months),monthlyAverageSatang:Math.round(receivedSatang/lifetime.months),
   averageOrderSatang:receivedCount?Math.round(receivedSatang/receivedCount):null,lastOrderAt:recency.lastOrderAt?.toISOString()??null,
   lastPurchaseAt:latestReceived?.order.eventAt.toISOString()??null,daysSinceLastOrder:recency.daysSinceLastOrder,
   inactive:recency.inactiveThreeMonths,returnedCount:summary.returnedCount,unknownAmountCount:summary.unknownAmountCount,
  };
 }).sort((a,b)=>b.orderCount-a.orderCount||b.purchasedSatang-a.purchasedSatang||a.code.localeCompare(b.code));
}
export type PlatformCustomerRow=Awaited<ReturnType<typeof platformCustomerData>>[number];
