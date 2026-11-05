import {transaction,userLock} from "./db";

export async function markAffiliatePaid(ids:string[],actor:string){
 if(!ids.length||ids.length>2000)throw new Error("ไม่มีรายการค้างจ่ายหรือรายการมากเกินไป");
 const refs=[...new Set(ids)].map(value=>{const parts=value.split(":");return parts.length===1?{kind:"friend",id:value}:{kind:parts[0],id:parts[1]};});
 if(refs.some(r=>!["friend","sale"].includes(r.kind)||!r.id))throw new Error("รายการไม่ถูกต้อง");
 const byKind=(kind:string)=>refs.filter(r=>r.kind===kind).map(r=>r.id);
 await transaction(async tx=>{
  const friends=await tx.commission.findMany({where:{id:{in:byKind("friend")}},include:{conversion:true}});
  const sales=await tx.salesOrder.findMany({where:{id:{in:byKind("sale")}}});
  if(friends.length+sales.length!==refs.length)throw new Error("กรุณาเปิดหน้าค่าคอมใหม่");
  const affiliateIds=new Set([...friends.map(r=>r.conversion.affiliateId),...sales.map(r=>r.affiliateId)]);
  if(affiliateIds.size!==1)throw new Error("จ่ายได้ทีละ Affiliate");const affiliateId=[...affiliateIds][0];await userLock(tx,"commission-payout:"+affiliateId);
  if(friends.some(r=>(r.conversion.source==="MOCK"&&process.env.NODE_ENV==="production")||(r.status!=="Paid"&&(r.status!=="Approved"||r.conversion.status!=="VERIFIED_NEW_FRIEND")))||sales.some(r=>!["PENDING","PAID"].includes(r.status)||r.commissionSatang===null))throw new Error("รายการเปลี่ยนแปลง กรุณาเปิดหน้าค่าคอมใหม่");
  const pendingFriends=friends.filter(r=>r.status==="Approved"),pendingSales=sales.filter(r=>r.status==="PENDING");
  if(!pendingFriends.length&&!pendingSales.length)return;
  const amountSatang=pendingFriends.reduce((s,r)=>s+r.amountSatang,0)+pendingSales.reduce((s,r)=>s+r.commissionSatang!,0);
  const at=new Date();
  const f=await tx.commission.updateMany({where:{id:{in:pendingFriends.map(r=>r.id)},status:"Approved"},data:{status:"Paid"}});
  if(f.count!==pendingFriends.length)throw new Error("รายการเปลี่ยนแปลง");
  for(const row of pendingSales){const updated=await tx.salesOrder.updateMany({where:{id:row.id,status:"PENDING",commissionSatang:row.commissionSatang},data:{status:"PAID",paidAt:at,paidAmountSatang:row.commissionSatang}});if(updated.count!==1)throw new Error("รายการเปลี่ยนแปลง");}
  await tx.auditLog.create({data:{actor,action:"COMMISSION_PAID_BATCH",entityId:affiliateId,details:{commissionIds:pendingFriends.map(r=>r.id),salesIds:pendingSales.map(r=>r.id),amountSatang}}});
 });
}
