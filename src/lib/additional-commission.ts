import {db,transaction,userLock} from './db';
import {salesCommissionUsesCost} from './sales-commission-rate';
import type {Prisma} from '@prisma/client';
export function additionalCommissionAmount(basis:string,bps:number,revenueSatang:number,costSatang:number|null,freightSatang:number|null=null){
 if(salesCommissionUsesCost(basis)&&costSatang===null||basis==='GROSS_PROFIT'&&freightSatang===null)return null;
 return Math.round(Math.max(0,revenueSatang-(salesCommissionUsesCost(basis)?costSatang!:0)-(basis==='GROSS_PROFIT'?freightSatang!:0))*bps/10000);
}
async function commissionFreight(tx:Prisma.TransactionClient,orderId:string,basis:string){
 if(basis!=='GROSS_PROFIT')return null;
 const shipment=await tx.shipment.findUnique({where:{orderId},select:{freightSatang:true,freightReportAt:true}});
 return shipment?.freightReportAt?shipment.freightSatang:null;
}
export async function processAdditionalCommissions(){
 const waitingProfit=await db.salesOrder.findMany({where:{status:'WAITING_COST',commissionBasis:{in:['PROFIT','GROSS_PROFIT']},recognizedAt:{not:null}},take:500});
 for(const candidate of waitingProfit)await transaction(async tx=>{
  await userLock(tx,'commission-payout:'+candidate.affiliateId);
  const sale=await tx.salesOrder.findUniqueOrThrow({where:{id:candidate.id}});
  const [cost,order]=await Promise.all([tx.stockDispatch.findUnique({where:{orderId:sale.orderId}}),tx.orderIntake.findUnique({where:{id:sale.orderId}})]);
  if(sale.status!=='WAITING_COST'||!sale.recognizedAt||!order||['CANCELLED','WITHDRAWN','RETURNED','EXPIRED'].includes(order.status)||cost?.status!=='POSTED'||cost.totalCostSatang===null)return;
  const freight=await commissionFreight(tx,sale.orderId,sale.commissionBasis),amount=additionalCommissionAmount(sale.commissionBasis,sale.commissionBps,sale.revenueSatang,cost.totalCostSatang,freight);
  if(amount===null)return;
  await tx.salesOrder.update({where:{id:sale.id},data:{status:'PENDING',commissionSatang:amount,commissionReadyAt:sale.commissionReadyAt??new Date()}});
 });
 const [pending,paid]=await Promise.all([db.additionalCommission.findMany({where:{status:{notIn:['PAID','CANCELLED']}},orderBy:{createdAt:'asc'},take:500}),db.additionalCommission.findMany({where:{status:'PAID',reversedAt:null}})]);
 const open=paid.length?await db.orderIntake.findMany({where:{id:{in:paid.map(p=>p.orderId)},status:{notIn:['CANCELLED','WITHDRAWN','RETURNED','EXPIRED']}},select:{id:true}}):[],openIds=new Set(open.map(o=>o.id));
 const recognized=paid.length?await db.salesOrder.findMany({where:{orderId:{in:paid.map(p=>p.orderId)},recognizedAt:{not:null},status:{not:'CANCELLED'}},select:{orderId:true}}):[],recognizedIds=new Set(recognized.map(s=>s.orderId));
 const rows=[...pending,...paid.filter(p=>!openIds.has(p.orderId)||!recognizedIds.has(p.orderId))];
 for(const candidate of rows)await transaction(async tx=>{
  await userLock(tx,'commission-payout:'+candidate.affiliateId);
  const row=await tx.additionalCommission.findUniqueOrThrow({where:{id:candidate.id}});
  const [order,sale,cost]=await Promise.all([tx.orderIntake.findUnique({where:{id:row.orderId}}),tx.salesOrder.findUnique({where:{orderId:row.orderId}}),tx.stockDispatch.findUnique({where:{orderId:row.orderId}})]);
  const closed=!order||['CANCELLED','WITHDRAWN','RETURNED','EXPIRED'].includes(order.status)||sale?.status==='CANCELLED';
  if(closed||row.status==='PAID'&&!sale?.recognizedAt){await tx.additionalCommission.update({where:{id:row.id},data:row.status==='PAID'?{reversedAt:new Date()}:{status:'CANCELLED',amountSatang:0}});return;}
  if(row.status==='PAID')return;
  if(!sale?.recognizedAt){if(row.status!=='WAITING_SALE')await tx.additionalCommission.update({where:{id:row.id},data:{status:'WAITING_SALE',amountSatang:null}});return;}
  const freight=await commissionFreight(tx,row.orderId,row.basis);
  const amount=additionalCommissionAmount(row.basis,row.bps,sale.revenueSatang,cost?.status==='POSTED'?cost.totalCostSatang:null,freight);
  await tx.additionalCommission.update({where:{id:row.id},data:{status:amount===null?'WAITING_COST':'PENDING',amountSatang:amount,commissionReadyAt:row.commissionReadyAt??(amount===null?null:new Date())}});
 });
}
