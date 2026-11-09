import {cache} from 'react';
import {db} from './db';
import {orderRoundClosingDay} from './order-round';
import {loadOrderRoundSettings} from './order-round-settings';
import {parseOrderText} from './order-parser';
import {orderStockItems} from './order-stock-items';
import {normalizeName,quotedTotal} from './shipment-matching';
import {canonicalCustomerCode} from './customer-code';

export type DuplicateOrderMatch={id:string;orderNumber:string;recipient:string|null;eventAt:Date;reasons:string[]};
type Candidate={id:string;orderNumber:string;recipient:string|null;eventAt:Date;rawText:string|null;status:string;paymentSlip:{version:string}|null};
function orderFingerprint(rawText:string|null){
 const parsed=parseOrderText(rawText??''),stock=orderStockItems(rawText),amount=quotedTotal(rawText??'');
 if(parsed?.customerCode&&stock.items.length&&!stock.issues.length&&amount!==null){
  return JSON.stringify([canonicalCustomerCode(parsed.customerCode),normalizeName(parsed.recipient??''),parsed.phone,normalizeName(parsed.address??''),parsed.payment,amount,stock.items.sort((a,b)=>a.code.localeCompare(b.code))]);
 }
 return (rawText??'').normalize('NFKC').split(/\r?\n/).filter(line=>!/^\s*(?:รหัสผู้ขาย|Green Coin)\s*[:：]/i.test(line)).join(' ').trim().replace(/\s+/g,' ').toUpperCase();
}
export function findDuplicateOrders(orders:Candidate[],closeMinutes=720){
 const active=orders.filter(order=>!['CANCELLED','WITHDRAWN','EXPIRED','RETURNED'].includes(order.status));
 const groups=new Map<string,{reason:string;orders:Candidate[]}>();
 for(const order of active){
  const text=orderFingerprint(order.rawText);
  const keys:{key:string;reason:string}[]=[];
  if(text)keys.push({key:'text:'+orderRoundClosingDay(order.eventAt,closeMinutes)+':'+text,reason:'ข้อมูลลูกค้าและสินค้าเหมือนกันในรอบเดียวกัน'});
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
 const settings=await loadOrderRoundSettings();
 const orders=await db.orderIntake.findMany({where:{status:{notIn:['CANCELLED','WITHDRAWN','EXPIRED','RETURNED']},...(username?{sellerUsername:username,affiliateId}: {})},select:{id:true,orderNumber:true,recipient:true,eventAt:true,rawText:true,status:true,paymentSlip:{select:{version:true}}}});
 return findDuplicateOrders(orders,settings.closeMinutes);
});
