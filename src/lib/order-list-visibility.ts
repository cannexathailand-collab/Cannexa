import type {Prisma} from '@prisma/client';
import {db} from './db';

export const visibleOrderWhere:Prisma.OrderIntakeWhereInput={
 status:{notIn:['CANCELLED','WITHDRAWN']},withdrawnAt:null,
};

export function isCancelledOrder(order:{status:string;withdrawnAt?:Date|null},shipment?:{status?:string;fulfillmentStatus?:string}|null){
 return !!order.withdrawnAt||['CANCELLED','WITHDRAWN'].includes(order.status)||!!shipment&&(['CANCELLED','WITHDRAWN'].includes(shipment.status??'')||shipment.fulfillmentStatus==='CANCELLED');
}

export async function visibleWebsiteOrders<T extends {status:string;intakeOrderId:string|null}>(orders:T[]){
 const candidates=orders.filter(order=>!['REJECTED','CANCELLED','WITHDRAWN'].includes(order.status));
 const ids=candidates.flatMap(order=>order.intakeOrderId?[order.intakeOrderId]:[]);
 if(!ids.length)return candidates;
 const [cancelled,shipments]=await Promise.all([
  db.orderIntake.findMany({where:{id:{in:ids},OR:[{status:{in:['CANCELLED','WITHDRAWN']}},{withdrawnAt:{not:null}}]},select:{id:true}}),
  db.shipment.findMany({where:{orderId:{in:ids},OR:[{status:{in:['CANCELLED','WITHDRAWN']}},{fulfillmentStatus:'CANCELLED'}]},select:{orderId:true}}),
 ]);
 const hidden=new Set([...cancelled.map(row=>row.id),...shipments.flatMap(row=>row.orderId?[row.orderId]:[])]);
 return candidates.filter(order=>!order.intakeOrderId||!hidden.has(order.intakeOrderId));
}
