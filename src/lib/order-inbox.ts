import {db} from './db';
export async function loadOrderInbox(){
 const [bots,groups,orders,sellers]=await Promise.all([db.orderBot.findMany({orderBy:{createdAt:'asc'},select:{id:true,name:true,botId:true,active:true}}),db.orderGroup.findMany({where:{purpose:'ORDER'},orderBy:{lastSeenAt:'desc'}}),db.orderIntake.findMany({where:{status:{notIn:['WITHDRAWN','CANCELLED']}},orderBy:{createdAt:'desc'},take:100}),db.userAccount.findMany({where:{role:'employee',active:true,affiliateId:{not:null}},select:{username:true,affiliateId:true},orderBy:{username:'asc'}})]);
 const ids=orders.map(o=>o.id);
 const [sales,shipments]=await Promise.all([db.salesOrder.findMany({where:{orderId:{in:ids}},select:{orderId:true,commissionSatang:true,status:true,paymentMethod:true}}),db.shipment.findMany({where:{orderId:{in:ids}},select:{orderId:true,tracking:true,fulfillmentStatus:true,dispatchedAt:true}})]);
 const saleByOrder=new Map(sales.map(s=>[s.orderId,s])),shipmentByOrder=new Map(shipments.map(s=>[s.orderId,s]));
 const sellerNames=new Map<string,string[]>();for(const seller of sellers){const id=seller.affiliateId!;sellerNames.set(id,[...(sellerNames.get(id)??[]),seller.username]);}
 const sellerLabel=(id:string|null,fallback:string|null)=>{const names=id?sellerNames.get(id):undefined;return names?.length===1?names[0]:(fallback??'ยังไม่ระบุ');};
 const botNames=new Map(bots.map(b=>[b.botId,b.name])),groupNames=new Map(groups.map(g=>[g.id,(botNames.get(g.botId)??'ร้านค้า')+' · '+(g.name||'กลุ่มยังไม่ตั้งชื่อ')]));
 return {bots,groups,orders,sellers,saleByOrder,shipmentByOrder,sellerLabel,botNames,groupNames};
}
