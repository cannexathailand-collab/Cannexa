import type {Prisma} from "@prisma/client";
import {userLock} from "./db";
import {revokeSalesRecognition} from "./sales-recognition";
export async function reverseOrderSales(tx:Prisma.TransactionClient,orderIds:string[],actor='line-unsend'){
 const initial=await tx.salesOrder.findMany({where:{orderId:{in:orderIds},status:{not:"CANCELLED"}},select:{affiliateId:true}});
 for(const affiliateId of [...new Set(initial.map(r=>r.affiliateId))].sort())await userLock(tx,"commission-payout:"+affiliateId);
 const sales=await tx.salesOrder.findMany({where:{orderId:{in:orderIds},status:{not:"CANCELLED"}}});
 for(const sale of sales){
  await revokeSalesRecognition(tx,sale,actor,actor==='line-unsend'?'ผู้ส่งยกเลิกออเดอร์':'เจ้าหน้าที่ยกเลิกออเดอร์');
  if(sale.status==="PAID")continue;
  await tx.salesOrder.update({where:{id:sale.id},data:{status:"CANCELLED",commissionSatang:0,recognizedAt:null}});
 }
}
