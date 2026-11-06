import type {AdditionalCommission,Affiliate,SpecialCommission} from '@prisma/client';
import {db} from './db';
import {report,since} from './report';
import {isRecognizedSale,loadSalesRows,type SaleRow} from './sales-report';
type FriendRow=Omit<Awaited<ReturnType<typeof report>>[number],'employeeAccounts'>&{employeeAccounts:{username:string}[]};
type Rates=Pick<Affiliate,'id'|'rateSatang'|'salesCommissionBasis'|'salesCommissionBps'|'salesCommissionTransferBps'|'salesCommissionCodBps'>;
export function summarizeAffiliatePerformance(friends:FriendRow[],sales:SaleRow[],extras:AdditionalCommission[],rates:Rates[],from:Date,specials:SpecialCommission[]=[]){
 const rateMap=new Map(rates.map(r=>[r.id,r])),recognized=sales.filter(s=>isRecognizedSale(s)&&s.recognizedAt!>=from);
 return friends.map(friend=>{
  const usernames=new Set(friend.employeeAccounts.map(a=>a.username));
  const referred=recognized.filter(s=>s.affiliateId===friend.id),closed=recognized.filter(s=>s.order?.sellerCode===friend.code||s.order?.sellerUsername&&usernames.has(s.order.sellerUsername));
  const primary=sales.filter(s=>s.affiliateId===friend.id&&s.createdAt>=from),additional=extras.filter(e=>e.affiliateId===friend.id&&e.createdAt>=from);
  const pendingSalesSatang=primary.reduce((n,s)=>n+(s.status==='PENDING'?(s.commissionSatang??0):0),0)+additional.reduce((n,e)=>n+(e.status==='PENDING'?(e.amountSatang??0):0),0);
  const paidSalesSatang=primary.reduce((n,s)=>n+(s.status==='PAID'?(s.paidAmountSatang??s.commissionSatang??0):0),0)+additional.reduce((n,e)=>n+(e.status==='PAID'?(e.paidAmountSatang??e.amountSatang??0):0),0);
  const specialCommissionSatang=specials.filter(s=>s.affiliateId===friend.id&&s.paidAt>=from).reduce((n,s)=>n+s.amountSatang,0);
  return {...friend,rates:rateMap.get(friend.id),referredCount:referred.length,referredRevenueSatang:referred.reduce((n,s)=>n+s.revenueSatang,0),referredCustomers:new Set(referred.flatMap(s=>s.customer?[s.customer.code]:[])).size,closedCount:closed.length,closedRevenueSatang:closed.reduce((n,s)=>n+s.revenueSatang,0),pendingSalesSatang,paidSalesSatang,specialCommissionSatang,waitingCost:primary.filter(s=>s.status==='WAITING_COST').length+additional.filter(e=>e.status==='WAITING_COST').length,totalCommissionSatang:friend.commissionSatang+pendingSalesSatang+paidSalesSatang+specialCommissionSatang,pendingCommissionSatang:friend.commissionSatang-friend.paidSatang+pendingSalesSatang,paidCommissionSatang:friend.paidSatang+paidSalesSatang+specialCommissionSatang};
 });
}
export async function affiliatePerformance(period:string){
 const [friends,sales,extras,rates,specials]=await Promise.all([report(period,undefined,true),loadSalesRows(),db.additionalCommission.findMany(),db.affiliate.findMany({select:{id:true,rateSatang:true,salesCommissionBasis:true,salesCommissionBps:true,salesCommissionTransferBps:true,salesCommissionCodBps:true}}),db.specialCommission.findMany()]);
 return summarizeAffiliatePerformance(friends,sales,extras,rates,since(period),specials);
}
export type AffiliatePerformance=Awaited<ReturnType<typeof affiliatePerformance>>[number];
