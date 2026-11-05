import {db,transaction,userLock} from "./db";
import {sha} from "./crypto";
import {decryptGmail,type GmailConfig} from "./gmail";
import {saveFreightCost} from "./freight-cost";
import {parseMyOrderXlsx} from "./myorder-xlsx";
import {shipmentCandidates,nonCodShipmentCandidates,compatibleCodCandidates} from "./shipment-matching";
import {hasActualDispatch,reconcileSalesRecognition,revokeSalesRecognition} from "./sales-recognition";

const senders={SHIPMENT:"account-thaipost-freight@myorder.ai",COD:"account-thaipost-cod@myorder.ai"};
type MailPart={filename?:string;body?:{attachmentId?:string;data?:string;size?:number};parts?:MailPart[]};
export async function accessToken(config:GmailConfig,refreshToken:string){const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,refresh_token:refreshToken,grant_type:"refresh_token"}),cache:"no-store",signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error("GMAIL_RECONNECT");const result=await response.json();if(typeof result.access_token!=="string")throw new Error("GMAIL_RECONNECT");return result.access_token as string;}
export async function importGmailReports(actor:string,messageIds?:string[]){
 const connection=await db.gmailConnection.findUnique({where:{id:"active"}});if(!connection?.encryptedToken)throw new Error("GMAIL_RECONNECT");
 const token=await accessToken(decryptGmail<GmailConfig>(connection.encryptedConfig),decryptGmail<{refreshToken:string}>(connection.encryptedToken).refreshToken);
 const api=async(path:string,allowMissing=false)=>{const response=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/"+path,{headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(15000)});if(allowMissing&&response.status===404)return null;if(!response.ok)throw new Error("GMAIL_READ_FAILED");return response.json();};
 const query="in:anywhere {from:"+senders.SHIPMENT+" from:"+senders.COD+"} newer_than:30d has:attachment";
 const params=new URLSearchParams({q:query,maxResults:"10",includeSpamTrash:"true"});if(connection.syncPageToken)params.set("pageToken",connection.syncPageToken);
 const list=messageIds?{messages:messageIds.map(id=>({id})),nextPageToken:undefined}:await api("messages?"+params);let imported=0;
 for(const item of list.messages??[]){
  let message=await api("messages/"+encodeURIComponent(item.id)+"?format=metadata&metadataHeaders=From&metadataHeaders=Subject",true);if(!message)continue;const headers=message.payload?.headers??[];const header=(name:string)=>String(headers.find((h:{name:string})=>h.name.toLowerCase()===name)?.value??"");
  const from=header("from").match(/<([^>]+)>/)?.[1]??header("from").trim();const kind=from.toLowerCase()===senders.SHIPMENT?"SHIPMENT":from.toLowerCase()===senders.COD?"COD":null;if(!kind)continue;message=await api("messages/"+encodeURIComponent(item.id)+"?format=full",true);if(!message)continue;
  const subject=header("subject"),reportAt=new Date(Number(message.internalDate));if(!Number.isFinite(reportAt.getTime()))throw new Error("INVALID_REPORT_DATE");
  const parts:MailPart[]=[];function walk(part:MailPart){if(part.filename?.toLowerCase().endsWith(".xlsx"))parts.push(part);for(const child of part.parts??[])walk(child);}walk(message.payload);
  for(const part of parts){
   const id=sha(connection.email+":"+item.id+":"+part.filename);if(await db.gmailImport.findFirst({where:{messageId:item.id,filename:part.filename!}}))continue;
   if((part.body?.size??0)>5*1024*1024)throw new Error("FILE_TOO_LARGE");
   const attachment=part.body?.attachmentId?await api("messages/"+encodeURIComponent(item.id)+"/attachments/"+encodeURIComponent(part.body.attachmentId),true):part.body;if(!attachment)continue;
   if(typeof attachment?.data!=="string")throw new Error("ATTACHMENT_MISSING");const rows=await parseMyOrderXlsx(Buffer.from(attachment.data,"base64url"),kind);
   await transaction(async tx=>{
    await userLock(tx,"gmail-reports");const current=await tx.gmailConnection.findUnique({where:{id:"active"}});if(current?.revision!==connection.revision||!current.encryptedToken)throw new Error("GMAIL_RECONNECT");if(await tx.gmailImport.findFirst({where:{messageId:item.id,filename:part.filename!}}))return;
    await tx.gmailImport.create({data:{id,messageId:item.id,filename:part.filename!,subject,kind,rowCount:rows.length,reportAt}});
    for(const row of rows){if(kind==="SHIPMENT"){const old=await tx.shipment.findUnique({where:{tracking:row.tracking}});if(old){if(old.codSatang!==row.amountSatang||old.recipient!==row.recipient||old.phone!==row.phone||old.address!==row.address)throw new Error("SHIPMENT_CONFLICT");await saveFreightCost(tx,row,id,reportAt);continue;}await tx.shipment.create({data:{tracking:row.tracking,importId:id,recipient:row.recipient,phone:row.phone,address:row.address,codSatang:row.amountSatang,reportAt,freightSatang:row.freightSatang,totalChargeSatang:row.totalChargeSatang,...(row.totalChargeSatang!==undefined||row.freightSatang!==undefined?{freightReportAt:reportAt,freightImportId:id}:{})}});}else{const old=await tx.codReceipt.findUnique({where:{tracking:row.tracking}});if(old){if(old.amountSatang!==row.amountSatang)throw new Error("COD_CONFLICT");continue;}await tx.codReceipt.create({data:{tracking:row.tracking,importId:id,amountSatang:row.amountSatang,reportAt}});}}
    await tx.auditLog.create({data:{actor,action:"GMAIL_REPORT_IMPORTED",entityId:id,details:{kind,rows:rows.length}}});
   });imported++;
  }
 }
 await db.gmailConnection.updateMany({where:{id:"active",revision:connection.revision},data:{...(!messageIds?{syncPageToken:list.nextPageToken??null}:{}),lastSyncAt:new Date()}});
 return {imported,hasMore:!!list.nextPageToken};
}

export async function matchShipments(actor:string){
 return transaction(async tx=>{
  await userLock(tx,"shipment-matching");
  const shipments=await tx.shipment.findMany({where:{status:{notIn:["RETURNED","CANCELLED"]},OR:[{orderId:null},{status:{in:["MATCHED_WAITING_COD","MATCHED_COD_AMOUNT_MISMATCH"]}}]},orderBy:[{reportAt:"asc"},{tracking:"asc"}],take:1000});
  const excludedParcels=await tx.shipment.findMany({where:{status:{in:["RETURNED","CANCELLED"]}}});
  const receipts=await tx.codReceipt.findMany({where:{tracking:{in:shipments.map(s=>s.tracking)}},select:{tracking:true,amountSatang:true}});
  const receiptByTracking=new Map(receipts.map(r=>[r.tracking,r]));
  const orders=await tx.orderIntake.findMany({where:{status:{in:["WAITING_SHIPMENT","MATCHED_SHIPMENT_WAITING_COD","COD_AMOUNT_MISMATCH"]},affiliateId:{not:null}},orderBy:[{eventAt:"asc"},{id:"asc"}]});
  const transferOrders=await tx.orderIntake.findMany({where:{status:"TRANSFER_RECORDED",payment:"โอน",affiliateId:{not:null}},orderBy:[{eventAt:"asc"},{id:"asc"}]});
  const claimOrders=await tx.orderIntake.findMany({where:{status:"CLAIM_WAITING_COST",payment:"เคลม",affiliateId:{not:null}},orderBy:[{eventAt:"asc"},{id:"asc"}]});
  const nonCodOrders=[...transferOrders,...claimOrders];
  const used=new Set<string>();let matched=0,ambiguous=0,codConfirmed=0,waitingCod=0,amountMismatch=0,transferMatched=0,shipmentLinked=0,claimMatched=0;
  const statusChanges=new Map<string,string>();
  const setStatus=(shipment:{tracking:string;status:string},status:string)=>{if(shipment.status===status)statusChanges.delete(shipment.tracking);else statusChanges.set(shipment.tracking,status);};
  for(const shipment of shipments){
   if(shipment.codSatang===0){
    const candidates=nonCodShipmentCandidates(shipment,nonCodOrders.filter(o=>!used.has(o.id)&&(!o.eventAt||!shipment.reportAt||o.eventAt<=shipment.reportAt)));
    if(candidates.length!==1){setStatus(shipment,candidates.length?"AMBIGUOUS_NON_COD":"WAITING_NON_COD_ORDER");continue;}
    const order=nonCodOrders.find(o=>o.id===candidates[0].id)!;
    const alternatives=shipments.filter(s=>!s.orderId&&(!order.eventAt||!s.reportAt||order.eventAt<=s.reportAt)&&nonCodShipmentCandidates(s,[order]).length);
    if(alternatives.length!==1){setStatus(shipment,"AMBIGUOUS_NON_COD");continue;}
    if(order.payment==="เคลม"){
     if(await tx.shipment.findUnique({where:{orderId:order.id},select:{tracking:true}}))continue;
     await tx.shipment.update({where:{tracking:shipment.tracking},data:{orderId:order.id,status:"MATCHED_CLAIM"}});
     await tx.auditLog.create({data:{actor,action:"CLAIM_SHIPMENT_LINKED",entityId:order.id,details:{tracking:shipment.tracking}}});used.add(order.id);claimMatched++;continue;
    }
    const sale=await tx.salesOrder.findUnique({where:{orderId:order.id}});
    if(!sale||sale.paymentMethod!=="TRANSFER"||sale.status==="CANCELLED"||sale.tracking)continue;
    await tx.salesOrder.update({where:{id:sale.id},data:{tracking:shipment.tracking}});
    await tx.shipment.update({where:{tracking:shipment.tracking},data:{orderId:order.id,status:"MATCHED_TRANSFER"}});
    if(hasActualDispatch(shipment))await reconcileSalesRecognition(tx,order,{...shipment,orderId:order.id},actor);else await revokeSalesRecognition(tx,sale,actor,"ยังไม่ยืนยันจัดส่งจริง");
    await tx.auditLog.create({data:{actor,action:"TRANSFER_SHIPMENT_LINKED",entityId:order.id,details:{tracking:shipment.tracking}}});used.add(order.id);transferMatched++;continue;
   }
   if(shipment.codSatang<0)continue;
   const receipt=receiptByTracking.get(shipment.tracking);
   if(!receipt){waitingCod++;if(!shipment.orderId)setStatus(shipment,"WAITING_COD");}
   else if(receipt.amountSatang!==shipment.codSatang){amountMismatch++;if(!shipment.orderId)setStatus(shipment,"COD_AMOUNT_MISMATCH");}
   else {codConfirmed++;if(!shipment.orderId)setStatus(shipment,"COD_CONFIRMED");}
   let order=shipment.orderId?orders.find(o=>o.id===shipment.orderId):undefined;
   let matchMethod=shipment.orderId?"LINKED_TRACKING":"EXACT";
   if(!shipment.orderId){
   const available=orders.filter(o=>o.status==="WAITING_SHIPMENT"&&!used.has(o.id));
   let candidates=shipmentCandidates(shipment,available);
   if(!candidates.length){
    candidates=compatibleCodCandidates(shipment,available);matchMethod="COMPATIBLE_UNIQUE";
    if(!candidates.length)continue;
    // A still-unpaid plausible parcel is also a conflict: don't steal an older receipt.
    const alternatives=shipments.filter(s=>!s.orderId&&s.codSatang>0&&compatibleCodCandidates(s,[candidates[0]]).length);
    if(candidates.length!==1||alternatives.length!==1){ambiguous++;setStatus(shipment,"AMBIGUOUS_ORDER");continue;}
   }
   if(!candidates.length)continue;
   if(candidates.some(o=>excludedParcels.some(s=>s.reportAt>shipment.reportAt&&compatibleCodCandidates(s,[o]).length))){ambiguous++;setStatus(shipment,"NEWER_RETURNED_OR_CANCELLED_PARCEL");continue;}
   if(new Set(candidates.map(o=>o.affiliateId)).size>1){ambiguous++;setStatus(shipment,"AMBIGUOUS_SELLER");continue;}
   order=orders.find(o=>o.id===candidates[0].id)!;
   await tx.shipment.update({where:{tracking:shipment.tracking},data:{orderId:order.id,status:"MATCHED_WAITING_COD"}});
   statusChanges.delete(shipment.tracking);
   await tx.orderIntake.update({where:{id:order.id},data:{status:"MATCHED_SHIPMENT_WAITING_COD"}});
   await tx.auditLog.create({data:{actor,action:"SHIPMENT_LINKED",entityId:order.id,details:{tracking:shipment.tracking,matchMethod}}});used.add(order.id);shipmentLinked++;
   }
   if(!order)continue;
   if(receipt&&receipt.amountSatang!==shipment.codSatang){
    await tx.shipment.update({where:{tracking:shipment.tracking},data:{status:"MATCHED_COD_AMOUNT_MISMATCH"}});
    await tx.orderIntake.update({where:{id:order.id},data:{status:"COD_AMOUNT_MISMATCH"}});continue;
   }
   if(!receipt)continue;
   if(order.salesCommissionBps===null||!order.salesCommissionBasis)continue;
   // Archived/suspended affiliates remain review-only, never silently credited.
   const affiliate=await tx.affiliate.findUnique({where:{id:order.affiliateId!},select:{active:true,archivedAt:true}});if(!affiliate?.active||affiliate.archivedAt)continue;
   await tx.shipment.update({where:{tracking:shipment.tracking},data:{orderId:order.id,status:"MATCHED"}});
   statusChanges.delete(shipment.tracking);
   await tx.orderIntake.update({where:{id:order.id},data:{status:"MATCHED_SHIPMENT"}});
   const profit=order.salesCommissionBasis==="PROFIT";
   const existingSale=await tx.salesOrder.findUnique({where:{orderId:order.id}});
   const settlement={paymentEvidence:"COD_RECEIPT",commissionSatang:profit?null:Math.round(shipment.codSatang*order.salesCommissionBps/10000),status:profit?"WAITING_COST":"PENDING"};
   if(existingSale){if(existingSale.revenueSatang!==shipment.codSatang)throw Error("COD_CONFLICT");await tx.salesOrder.update({where:{id:existingSale.id},data:{...settlement,...(existingSale.status==="PAID"?{status:"PAID",commissionSatang:existingSale.commissionSatang}:{})}});}
   else await tx.salesOrder.create({data:{orderId:order.id,tracking:shipment.tracking,affiliateId:order.affiliateId!,paymentMethod:"COD",...settlement,revenueSatang:shipment.codSatang,commissionBasis:order.salesCommissionBasis,commissionBps:order.salesCommissionBps}});
   if(hasActualDispatch(shipment))await reconcileSalesRecognition(tx,order,{...shipment,orderId:order.id},actor);else if(existingSale)await revokeSalesRecognition(tx,existingSale,actor,"ยังไม่ยืนยันจัดส่งจริง");
   await tx.auditLog.create({data:{actor,action:"SHIPMENT_MATCHED",entityId:order.id,details:{tracking:shipment.tracking,matchMethod}}});used.add(order.id);matched++;
  }
  const statusGroups=Map.groupBy([...statusChanges],([,status])=>status);
  for(const [status,rows] of statusGroups)await tx.shipment.updateMany({where:{tracking:{in:rows.map(([tracking])=>tracking)},orderId:null},data:{status}});
  return {matched,ambiguous,codConfirmed,waitingCod,amountMismatch,transferMatched,shipmentLinked,claimMatched};
 });
}
