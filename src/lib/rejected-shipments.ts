import {db} from './db';
import {sha} from './crypto';
import {phonesMatch} from './shipment-matching';
import type {ManualShipmentRow} from './manual-shipment-file';

export type RejectedOrderMatch={id:string;at:string;reasons:string[]};
export function matchingRejectedOrders(row:ManualShipmentRow,logs:{id:string;createdAt:Date;details:unknown}[]):RejectedOrderMatch[]{
 return logs.flatMap(log=>{
  if(!log.details||typeof log.details!=='object'||Array.isArray(log.details))return [];
  const details=log.details as Record<string,unknown>;
  if(typeof details.phone!=='string'||row.amountSatang===undefined||details.amountSatang!==row.amountSatang||!phonesMatch(details.phone,row.phone))return [];
  const reasons=Array.isArray(details.reasons)?details.reasons.filter((reason):reason is string=>typeof reason==='string'):[];
  return [{id:log.id,at:log.createdAt.toISOString(),reasons}];
 });
}

export async function recordRejectedShipmentMatches(actor:string,filename:string,rows:(ManualShipmentRow&{rejectedOrders:RejectedOrderMatch[]})[]){
 const data=rows.flatMap(row=>row.rejectedOrders.map(rejected=>({
  id:'rejected-shipment:'+sha(row.tracking+':'+rejected.id),
  actor,action:'ORDER_REJECTED_SHIPMENT_FOUND',entityId:rejected.id,
  details:{tracking:row.tracking,phone:row.phone,amountSatang:row.amountSatang??null,filename,rejectionId:rejected.id,rejectedAt:rejected.at,reasons:rejected.reasons,status:'NEEDS_REVIEW'},
 })));
 if(data.length)await db.auditLog.createMany({data,skipDuplicates:true});
}
