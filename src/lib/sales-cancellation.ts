import type {Prisma} from "@prisma/client";
import {userLock} from "./db";
export async function reverseOrderSales(tx:Prisma.TransactionClient,orderIds:string[]){
 const initial=await tx.salesOrder.findMany({where:{orderId:{in:orderIds},status:{not:"CANCELLED"}},select:{affiliateId:true}});
 for(const affiliateId of [...new Set(initial.map(r=>r.affiliateId))].sort())await userLock(tx,"commission-payout:"+affiliateId);
 const sales=await tx.salesOrder.findMany({where:{orderId:{in:orderIds},status:{not:"CANCELLED"}}});
 for(const sale of sales){
  if(sale.status==="PAID")continue;
  await tx.salesOrder.update({where:{id:sale.id},data:{status:"CANCELLED",commissionSatang:0}});
 }
}
