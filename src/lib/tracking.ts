import {metaAdCode} from "./meta-ad";
import {transaction,userLock} from "./db";
import {sendMetaFriend} from "./meta";
import {classify} from "./policy";
import type {Prisma} from "@prisma/client";
async function audit(tx:Prisma.TransactionClient,action:string,id:string,details:Prisma.InputJsonValue,actor:string){await tx.auditLog.create({data:{actor,action,entityId:id,details}});}
async function confirmNewFriend(tx:Prisma.TransactionClient,key:string){
 const c=await tx.conversion.findUnique({where:{userKey:key},include:{click:true,affiliate:true,commission:true}});
 if(!c||!c.affiliate.active||c.commission||!["PENDING_REVIEW","NOT_FRIEND"].includes(c.status)||
    c.friendFlag!==true||c.friendshipChanged!==true||!c.click.loginAt||
    (c.source==="MOCK"&&process.env.NODE_ENV==="production"))return;
 const events=await tx.webhookEvent.findMany({where:{userKey:key}});
 if(events.some(e=>e.type==="unfollow"||e.isUnblocked===true||e.eventAt<c.click.createdAt))return;
 if(!events.some(e=>e.type==="follow"&&e.isUnblocked===false&&e.eventAt>=c.click.createdAt&&e.eventAt<=c.click.loginAt!))return;
 const reason="LINE ยืนยันการเพิ่มเพื่อนระหว่างเข้าสู่ระบบและมี Webhook ตรงกัน";
 const verified=await tx.conversion.update({where:{id:c.id},data:{status:"VERIFIED_NEW_FRIEND",verifiedAt:new Date(),reason,history:{create:{status:"VERIFIED_NEW_FRIEND",reason}}}});
 if(c.affiliate.code!==metaAdCode)await tx.commission.create({data:{conversionId:c.id,amountSatang:c.rateSatang,status:"Approved"}});
 return {verified, meta:c.source==="LINE"&&c.click.metaFbc&&verified.verifiedAt?{id:verified.id,verifiedAt:verified.verifiedAt,fbc:c.click.metaFbc}:null};
}
export async function recordLogin(clickId:string,key:string,friendFlag:boolean|null,changed:boolean|null){
 const result = await transaction(async tx=>{
  await userLock(tx,key);
  const click=await tx.click.findUniqueOrThrow({where:{id:clickId},include:{affiliate:true}});
  await tx.click.update({where:{id:clickId},data:{userKey:key,loginAt:new Date(),loginResult:"SUCCESS",status:"LOGIN_SUCCESS"}});
  const prior=await tx.conversion.findUnique({where:{userKey:key}});
  if(prior){
   // Preserve attribution; allow friendship API recovery without creating a second conversion.
   if(["PENDING_REVIEW","NOT_FRIEND"].includes(prior.status)){
    const events=await tx.webhookEvent.findMany({where:{userKey:key}});
    const origin=await tx.click.findUniqueOrThrow({where:{id:prior.clickId}});
    const decision=classify({friendFlag,changed,priorFriend:events.some(e=>e.type==="follow"&&e.eventAt<origin.createdAt),unblocked:events.some(e=>e.type==="unfollow"||e.isUnblocked===true),follow:events.some(e=>e.type==="follow")});
    return {conversion:await tx.conversion.update({where:{id:prior.id},data:{friendFlag,...decision,history:{create:[...(friendFlag===true?[{status:"VERIFIED_FRIEND" as const,reason:"Friendship API checked again"}]:[]),decision]}}}),meta:null};
   }
   return {conversion:prior,meta:null};
  }
  const events=await tx.webhookEvent.findMany({where:{userKey:key},orderBy:{eventAt:"asc"}});
  const decision=classify({friendFlag,changed,priorFriend:events.some(e=>e.type==="follow"&&e.eventAt<click.createdAt),unblocked:events.some(e=>e.type==="unfollow"||e.isUnblocked===true),follow:events.some(e=>e.type==="follow")});
  const history:{status:"LOGIN_SUCCESS"|"VERIFIED_FRIEND"|"NOT_FRIEND"|"UNBLOCKED"|"EXISTING_FRIEND"|"PENDING_REVIEW";reason:string}[]=[{status:"LOGIN_SUCCESS",reason:"ตรวจสอบ ID Token สำเร็จ"}];
  if(friendFlag===true)history.push({status:"VERIFIED_FRIEND",reason:"friendFlag=true ยืนยันเฉพาะสถานะปัจจุบัน"});
  history.push(decision);
  const issued=click.source==='LINE'?await tx.customer.findUnique({where:{lineUserKey:key},select:{code:true}}):null;
  const created=await tx.conversion.create({data:{...(issued?{customerCode:issued.code}:{}),source:click.source,userKey:key,clickId,affiliateId:click.affiliateId,rateSatang:click.affiliate.rateSatang,friendFlag,friendshipChanged:changed,...decision,history:{create:history}}});
  const confirmed=await confirmNewFriend(tx,key);
  return {conversion:confirmed?.verified??created,meta:confirmed?.meta};
 });
 if(result.meta)await sendMetaFriend(result.meta);
 return result.conversion;
}
export async function webhook(event:{id:string;key:string;type:string;at:Date;unblocked:boolean|null}){
 const confirmed=await transaction(async tx=>{
  await userLock(tx,event.key);
  if(await tx.webhookEvent.findUnique({where:{id:event.id}}))return;
  await tx.webhookEvent.create({data:{id:event.id,userKey:event.key,type:event.type,eventAt:event.at,isUnblocked:event.unblocked}});
  const c=await tx.conversion.findUnique({where:{userKey:event.key},include:{click:true,commission:true}});
  if(!c)return;
  const blockEvidence=event.type==="unfollow"||event.unblocked===true;
  const awaitingDecision=["PENDING_REVIEW","NOT_FRIEND"].includes(c.status);
  // New block/unblock evidence must stop an undecided candidate. Later activity
  // alone does not revoke a commission earned and approved before that activity.
  if((blockEvidence&&(awaitingDecision||event.at<=c.createdAt))||event.at<c.click.createdAt){
   const status=event.type==="unfollow"||event.unblocked===true?"UNBLOCKED":"EXISTING_FRIEND";
   await tx.conversion.update({where:{id:c.id},data:{status,reason:"พบประวัติ Webhook ขัดกับการเป็นเพื่อนใหม่",history:{create:{status,reason:"Webhook "+event.id}}}});
   if(c.commission&&c.commission.status!=="Rejected"){
    if(c.commission.status!=="Paid")await tx.commission.update({where:{id:c.commission.id},data:{status:"Rejected"}});
    await tx.auditLog.create({data:{actor:"webhook",action:c.commission.status==="Paid"?"PAID_RECONCILIATION_REQUIRED":"COMMISSION_REVOKED",entityId:c.id,details:{eventId:event.id,previous:c.commission.status}}});
   }
  }else{
   return confirmNewFriend(tx,event.key);
  }
 });
 if(confirmed?.meta)await sendMetaFriend(confirmed.meta);
}
export async function review(id:string,action:"approve"|"reject"|"paid",reason:string,actor="admin"){
 if(action==="approve")throw new Error("ระบบนับเพื่อนใหม่จากหลักฐาน LINE อัตโนมัติ");
 if(reason.trim().length<20)throw new Error("กรุณาระบุเหตุผล/หลักฐานอย่างน้อย 20 ตัวอักษร");
 return transaction(async tx=>{
  const before=await tx.conversion.findUniqueOrThrow({where:{id},include:{commission:true,affiliate:true}});
  await userLock(tx,before.userKey);
  if(before.source==="MOCK"&&process.env.NODE_ENV==="production")throw new Error("Cannot pay MOCK data");
  if(action==="paid"){
   if(before.commission?.status==="Paid")return before;
   if(before.status!=="VERIFIED_NEW_FRIEND"||before.commission?.status!=="Approved")throw new Error("ต้องอนุมัติก่อนจ่าย");
   await tx.commission.update({where:{conversionId:id},data:{status:"Paid",paidAt:new Date()}});
  }else{
   if(before.commission?.status==="Paid")throw new Error("จ่ายแล้ว ต้องทำ reconciliation");
   if(before.status==="REJECTED")return before;
   await tx.conversion.update({where:{id},data:{status:"REJECTED",reason,history:{create:{status:"REJECTED",reason}}}});
   await tx.commission.upsert({where:{conversionId:id},create:{conversionId:id,amountSatang:before.rateSatang,status:"Rejected"},update:{status:"Rejected"}});
  }
  await audit(tx,"COMMISSION_"+action.toUpperCase(),id,{reason,beforeStatus:before.status,beforeCommission:before.commission?.status??"Pending",amountSatang:before.rateSatang},actor);
 });
}
