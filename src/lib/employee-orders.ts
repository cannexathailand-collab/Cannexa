import {db} from "./db";
export async function employeeOrders(affiliateId:string|null|undefined,username:string,month:string){
 if(!affiliateId||!username)return {orders:[],sales:[]};
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error("Invalid order month");
 const start=new Date(month+"-01T00:00:00+07:00");
 const [year,monthNumber]=month.split("-").map(Number);
 const end=new Date(Date.UTC(year,monthNumber,1)-7*60*60*1000);
 const orders=await db.orderIntake.findMany({where:{affiliateId,sellerUsername:username,status:{notIn:["WITHDRAWN","CANCELLED"]},createdAt:{gte:start,lt:end}},orderBy:{createdAt:"desc"},take:100});
 const sales=orders.length?await db.salesOrder.findMany({where:{affiliateId,orderId:{in:orders.map(o=>o.id)}},select:{orderId:true,commissionSatang:true,status:true,paymentMethod:true}}):[];
 return {orders,sales};
}
