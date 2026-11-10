import {db} from './db';
import {bookedSalesReport} from './booked-sales';
import {loadSalesRows} from './sales-report';
import {loadOrderRoundSettings} from './order-round-settings';
import {orderRoundBounds,orderRoundClosingDay} from './order-round';
import {dayStart,shiftDay,DAY_MS} from './sales-dates';
import {executivePeriodSummary} from './executive-metrics';
import {readStockSheet} from './stock-google';
import {pendingStockSaleItems} from './order-stock-admission';
import {stockSellableQuantity} from './stock-sales-limit';
import {customerOrderRecency} from './crm-customer-recency';
import {loadCustomerCrm} from './customer-crm';

export async function executiveDashboard(input:{from?:string;to?:string;seller?:string},now=new Date()){
 const settings=await loadOrderRoundSettings();
 const today=orderRoundClosingDay(now,settings.closeMinutes),from=input.from||today,to=input.to||today;
 const days=Math.round((+dayStart(to)-+dayStart(from))/DAY_MS)+1;
 if(days<1||days>366||from>today||to>today)throw Error('INVALID_EXECUTIVE_RANGE');
 const start=orderRoundBounds(from,settings.closeMinutes).start;
 const end=new Date(Math.min(+orderRoundBounds(to,settings.closeMinutes).end,+now));
 const previousFrom=shiftDay(from,-days),previousTo=shiftDay(to,-days),previousStart=orderRoundBounds(previousFrom,settings.closeMinutes).start;
 const previousEnd=new Date(+previousStart+(+end-+start));
 const [booked,sales,costs,stock,pending,customers]=await Promise.all([
  bookedSalesReport({from:previousFrom,to,seller:input.seller},now),loadSalesRows(),
  db.stockDispatch.findMany({select:{orderId:true,status:true,totalCostSatang:true}}),
  readStockSheet().catch(()=>null),pendingStockSaleItems(),
  db.customer.findMany({where:{OR:[{conversionId:null},{conversion:{source:'LINE'}}]},select:{code:true}}),
 ]);
 const filteredSales=input.seller?sales.filter(row=>row.order?.sellerUsername===input.seller):sales;
 const current=executivePeriodSummary(booked.orderRows,filteredSales,costs,start,end);
 const previous=executivePeriodSummary(booked.orderRows,filteredSales,costs,previousStart,previousEnd);
 const summaries=await loadCustomerCrm(customers.map(customer=>customer.code));
 const inactive=[...summaries.values()].filter(summary=>customerOrderRecency(summary.allHistory,now).inactiveThreeMonths).length;
 const queued=new Map<string,number>();for(const item of pending)queued.set(item.code,(queued.get(item.code)??0)+item.quantityMilliG);
 const products=stock?.products.map(product=>({code:product.code,name:product.name,available:stockSellableQuantity(product,queued.get(product.code)??0)}))??null;
 const inventory=products?{total:products.length,unavailable:products.filter(row=>row.available===0).length,unknown:products.filter(row=>row.available===null).length,lowest:products.filter(row=>row.available!==null).sort((a,b)=>a.available!-b.available!||a.code.localeCompare(b.code)).slice(0,8),readAt:stock!.readAt.toISOString()}:null;
 const bucketDays=days>31?7:1,trend=[];
 for(let offset=0;offset<days;offset+=bucketDays){
  const day=shiftDay(from,offset),last=shiftDay(from,Math.min(days-1,offset+bucketDays-1));
  const bucketStart=orderRoundBounds(day,settings.closeMinutes).start,bucketEnd=new Date(Math.min(+orderRoundBounds(last,settings.closeMinutes).end,+end));
  const summary=executivePeriodSummary(booked.orderRows,filteredSales,costs,bucketStart,bucketEnd);
  trend.push({from:day,to:last,orders:summary.orderCount,orderedSatang:summary.unknownAmounts?null:summary.orderedSatang,completedSatang:summary.completedSatang,profitSatang:summary.profitSatang});
 }
 return {from,to,today,availableDays:booked.availableDays,previousFrom,previousTo,start:start.toISOString(),end:end.toISOString(),previousStart:previousStart.toISOString(),previousEnd:previousEnd.toISOString(),partial:+end<+orderRoundBounds(to,settings.closeMinutes).end,closeTime:settings.closeTime,seller:input.seller??'',sellerOptions:booked.sellerOptions,current,previous,trend,inventory,inactive,customerCount:customers.length,updatedAt:now.toISOString()};
}
export type ExecutiveDashboardData=Awaited<ReturnType<typeof executiveDashboard>>;
