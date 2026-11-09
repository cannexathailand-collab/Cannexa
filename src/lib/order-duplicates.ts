import {cache} from 'react';
import {db} from './db';
import {bangkokDay} from './sales-dates';

export type DuplicateOrderMatch={id:string;orderNumber:string;recipient:string|null;eventAt:Date;reasons:string[]};
type Candidate={id:string;orderNumber:string;recipient:string|null;eventAt:Date;rawText:string|null;status:string;paymentSlip:{version:string}|null};
export function findDuplicateOrders(orders:Candidate[]){
 const active=orders.filter(order=>!['CANCELLED','WITHDRAWN','EXPIRED','RETURNED'].includes(order.status));
 const groups=new Map<string,{reason:string;orders:Candidate[]}>();
 for(const order of active){
  const text=(order.rawText??'').normalize('NFKC').trim().replace(/\s+/g,' ').toUpperCase();
  const keys:{key:string;reason:string}[]=[];
  if(text)keys.push({key:'text:'+bangkokDay(order.eventAt)+':'+text,reason:'ข้อมูลออเดอร์เหมือนกันในวันเดียวกัน'});
  if(order.paymentSlip?.version)keys.push({key:'slip:'+order.paymentSlip.version,reason:'แนบรูปสลิปเดียวกัน'});
  for(const {key,reason} of keys){const group=groups.get(key)??{reason,orders:[]};group.orders.push(order);groups.set(key,group);}
 }
 const matches=new Map<string,Map<string,DuplicateOrderMatch>>();
 for(const group of groups.values()){
  if(group.orders.length<2)continue;
  for(const order of group.orders){
   const peers=matches.get(order.id)??new Map<string,DuplicateOrderMatch>();
   for(const peer of group.orders){
    if(peer.id===order.id)continue;
    const match=peers.get(peer.id)??{id:peer.id,orderNumber:peer.orderNumber,recipient:peer.recipient,eventAt:peer.eventAt,reasons:[]};
    if(!match.reasons.includes(group.reason))match.reasons.push(group.reason);
    peers.set(peer.id,match);
   }
   matches.set(order.id,peers);
  }
 }
 return new Map([...matches].map(([id,peers])=>[id,[...peers.values()]]));
}
export const loadDuplicateOrderReviews=cache(async(username?:string,affiliateId?:string|null)=>{
 const orders=await db.orderIntake.findMany({where:{status:{notIn:['CANCELLED','WITHDRAWN','EXPIRED','RETURNED']},...(username?{sellerUsername:username,affiliateId}: {})},select:{id:true,orderNumber:true,recipient:true,eventAt:true,rawText:true,status:true,paymentSlip:{select:{version:true}}}});
 return findDuplicateOrders(orders);
});
