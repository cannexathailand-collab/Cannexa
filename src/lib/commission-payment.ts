import {transaction,userLock} from "./db";

export async function markAffiliatePaid(ids:string[],actor:string){
 if(!ids.length||ids.length>2000)throw new Error("ไม่มีรายการค้างจ่ายหรือรายการมากเกินไป");
 const refs=[...new Set(ids)].map(value=>{const parts=value.split(":");return parts.length===1?{kind:"friend",id:value}:{kind:parts[0],id:parts[1]};});
 if(refs.some(r=>!["friend","sale","extra"].includes(r.kind)||!r.id))throw new Error("รายการไม่ถูกต้อง");
 const byKind=(kind:string)=>refs.filter(r=>r.kind===kind).map(r=>r.id);
 await transaction(async tx=>{
  const friends=await tx.commission.findMany({where:{id:{in:byKind("friend")}},include:{conversion:true}});
  const sales=await tx.salesOrder.findMany({where:{id:{in:byKind("sale")}}});
  const extras=byKind('extra').length?await tx.additionalCommission.findMany({where:{id:{in:byKind('extra')}}}):[];
  if(friends.length+sales.length+extras.length!==refs.length)throw new Error("กรุณาเปิดหน้าค่าคอมใหม่");
  const affiliateIds=new Set([...friends.map(r=>r.conversion.affiliateId),...sales.map(r=>r.affiliateId),...extras.map(r=>r.affiliateId)]);
  if(affiliateIds.size!==1)throw new Error("จ่ายได้ทีละ Affiliate");const affiliateId=[...affiliateIds][0];await userLock(tx,"commission-payout:"+affiliateId);
  if(friends.some(r=>(r.conversion.source==="MOCK"&&process.env.NODE_ENV==="production")||(r.status!=="Paid"&&(r.status!=="Approved"||r.conversion.status!=="VERIFIED_NEW_FRIEND")))||sales.some(r=>!["PENDING","PAID"].includes(r.status)||r.commissionSatang===null))throw new Error("รายการเปลี่ยนแปลง กรุณาเปิดหน้าค่าคอมใหม่");
  if(extras.some(r=>!['PENDING','PAID'].includes(r.status)||r.amountSatang===null||r.reversedAt))throw Error('รายการค่าคอมเปลี่ยนแล้ว กรุณาตรวจใหม่');
  const pendingFriends=friends.filter(r=>r.status==="Approved"),pendingSales=sales.filter(r=>r.status==="PENDING"),pendingExtras=extras.filter(r=>r.status==='PENDING');
  for(const extra of pendingExtras){const order=await tx.orderIntake.findUnique({where:{id:extra.orderId}});const sale=await tx.salesOrder.findUnique({where:{orderId:extra.orderId}});if(!order||['CANCELLED','WITHDRAWN','RETURNED','EXPIRED'].includes(order.status)||!sale?.recognizedAt)throw Error('ออเดอร์ยังไม่เข้าเงื่อนไขจ่ายค่าคอม');}
  if(!pendingFriends.length&&!pendingSales.length&&!pendingExtras.length)return;
  const amountSatang=pendingFriends.reduce((s,r)=>s+r.amountSatang,0)+pendingSales.reduce((s,r)=>s+r.commissionSatang!,0)+pendingExtras.reduce((s,r)=>s+r.amountSatang!,0);
  const at=new Date();
  const f=await tx.commission.updateMany({where:{id:{in:pendingFriends.map(r=>r.id)},status:"Approved"},data:{status:"Paid",paidAt:at}});
  if(f.count!==pendingFriends.length)throw new Error("รายการเปลี่ยนแปลง");
  for(const row of pendingSales){const updated=await tx.salesOrder.updateMany({where:{id:row.id,status:"PENDING",commissionSatang:row.commissionSatang},data:{status:"PAID",paidAt:at,paidAmountSatang:row.commissionSatang}});if(updated.count!==1)throw new Error("รายการเปลี่ยนแปลง");}
  for(const row of pendingExtras){const updated=await tx.additionalCommission.updateMany({where:{id:row.id,status:'PENDING',amountSatang:row.amountSatang,reversedAt:null},data:{status:'PAID',paidAt:at,paidAmountSatang:row.amountSatang}});if(updated.count!==1)throw Error('รายการเปลี่ยนแปลง');}
  await tx.auditLog.create({data:{actor,action:"COMMISSION_PAID_BATCH",entityId:affiliateId,details:{commissionIds:pendingFriends.map(r=>r.id),salesIds:pendingSales.map(r=>r.id),additionalIds:pendingExtras.map(r=>r.id),amountSatang,...(pendingExtras.length?{items:[...pendingFriends.map(r=>({label:'ค่าคอมเพิ่มเพื่อน',amountSatang:r.amountSatang})),...pendingSales.map(r=>({label:'ค่าคอมผู้แนะนำจากยอดขาย',amountSatang:r.commissionSatang!})),...pendingExtras.map(r=>({label:'ค่าคอมผู้ปิดการขาย',amountSatang:r.amountSatang!}))]}:{})}}});
 });
}
