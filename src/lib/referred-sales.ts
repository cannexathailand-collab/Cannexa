import {db} from './db';
import {salesReport,summarizeSales,type SaleRow} from './sales-report';
export function summarizeVerifiedReferrals(rows:SaleRow[],referrerId:string,verifiedCodes:Set<string>){
 return summarizeSales(rows.filter(row=>row.customer?.referrerId===referrerId&&verifiedCodes.has(row.customer.code)));
}
export async function referredSalesReport(month:string,referrerId:string){
 const [sales,customers,registrations]=await Promise.all([
  salesReport({month}),
  db.customer.findMany({where:{referrerId},select:{code:true,conversionId:true}}),
  db.auditLog.findMany({where:{action:'CUSTOMER_REGISTERED',actor:'customer'},select:{entityId:true}}),
 ]);
 const registeredCodes=new Set(registrations.map(row=>row.entityId));
 const verifiedCodes=new Set(customers.filter(row=>row.conversionId||registeredCodes.has(row.code)).map(row=>row.code));
 return {summary:summarizeVerifiedReferrals(sales.summary.rows,referrerId,verifiedCodes)};
}
