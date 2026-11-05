import type {SalesOrder} from "@prisma/client";
import {db} from "./db";
import {commissionPeriod} from "./commission-month";
type OrderInfo={id:string;orderNumber:string;sellerUsername:string|null;sellerCode:string|null;payment:string|null;status:string};
type AffiliateInfo={id:string;name:string;code:string};
export type SaleRow=SalesOrder&{order:OrderInfo|null;affiliate:AffiliateInfo|null};
export function summarizeSales(rows:SaleRow[]){
 const included=rows.filter(s=>["PENDING","PAID","WAITING_COST"].includes(s.status)&&s.order?.payment!=="เคลม"&&!['RETURNED','CANCELLED','WITHDRAWN'].includes(s.order?.status??''));
 return {rows:included,count:included.length,revenueSatang:included.reduce((n,s)=>n+s.revenueSatang,0),transferSatang:included.filter(s=>s.paymentMethod==="TRANSFER").reduce((n,s)=>n+s.revenueSatang,0),codSatang:included.filter(s=>s.paymentMethod==="COD").reduce((n,s)=>n+s.revenueSatang,0),pendingCommissionSatang:included.filter(s=>s.status==="PENDING").reduce((n,s)=>n+(s.commissionSatang??0),0),paidCommissionSatang:included.filter(s=>s.status==="PAID").reduce((n,s)=>n+(s.paidAmountSatang??s.commissionSatang??0),0),waitingCost:included.filter(s=>s.commissionSatang===null).length};
}
export async function salesReport(requestedMonth?:string){
 const sales=await db.salesOrder.findMany({where:{status:{in:["PENDING","PAID","WAITING_COST"]}},orderBy:{createdAt:"desc"}});
 const {month,months,entries}=commissionPeriod(sales.map(s=>({...s,conversion:{verifiedAt:null,createdAt:s.createdAt}})),requestedMonth);
 const [orders,affiliates]=await Promise.all([db.orderIntake.findMany({where:{id:{in:entries.map(s=>s.orderId)}},select:{id:true,orderNumber:true,sellerUsername:true,sellerCode:true,payment:true,status:true}}),db.affiliate.findMany({where:{id:{in:[...new Set(entries.map(s=>s.affiliateId))]}},select:{id:true,name:true,code:true}})]);
 const byOrder=new Map(orders.map(o=>[o.id,o])),byAffiliate=new Map(affiliates.map(a=>[a.id,a]));
 const summary=summarizeSales(entries.map(s=>({...s,order:byOrder.get(s.orderId)??null,affiliate:byAffiliate.get(s.affiliateId)??null})));
 const groups=[...Map.groupBy(summary.rows,s=>s.order?.sellerUsername??"affiliate:"+s.affiliateId)].map(([key,rows])=>({key,name:rows[0].order?.sellerUsername??rows[0].affiliate?.name??"บัญชีเดิม",code:rows[0].affiliate?.code??"",...summarizeSales(rows)})).sort((a,b)=>b.revenueSatang-a.revenueSatang);
 return {month,months,summary,groups};
}
