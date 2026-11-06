import {db} from "./db";
export async function employeeOrders(affiliateId:string|null|undefined,username:string,month:string){
 if(!affiliateId||!username)return {orders:[],sales:[],shipments:[]};
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error("Invalid order month");
 const start=new Date(month+"-01T00:00:00+07:00");
 const [year,monthNumber]=month.split("-").map(Number);
 const end=new Date(Date.UTC(year,monthNumber,1)-7*60*60*1000);
 const orders=await db.orderIntake.findMany({where:{affiliateId,sellerUsername:username,status:{notIn:["WITHDRAWN","CANCELLED"]},createdAt:{gte:start,lt:end}},orderBy:{createdAt:"desc"},take:100});
 const sales=orders.length?await db.salesOrder.findMany({where:{affiliateId,orderId:{in:orders.map(o=>o.id)}},select:{orderId:true,commissionSatang:true,status:true,paymentMethod:true}}):[];
 const shipments=orders.length?await db.shipment.findMany({where:{orderId:{in:orders.map(o=>o.id)}},select:{orderId:true,tracking:true,fulfillmentStatus:true,dispatchedAt:true}}):[];
 const extras=orders.some(o=>o.commissionAffiliateId&&o.commissionAffiliateId!==affiliateId)?await db.additionalCommission.findMany({where:{affiliateId,orderId:{in:orders.map(o=>o.id)}}}):[];
 return {orders,sales:[...sales,...extras.map(e=>({orderId:e.orderId,commissionSatang:e.amountSatang,status:e.status==='WAITING_SALE'?'WAITING_COD':e.status,paymentMethod:orders.find(o=>o.id===e.orderId)?.payment==='โอน'?'TRANSFER':'COD'}))],shipments};
}
