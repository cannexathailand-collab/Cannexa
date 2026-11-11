import {cache} from 'react';
import {currentAccount} from '@/lib/auth';
import {db} from '@/lib/db';
import {canAttachPaymentSlip,readOrderPaymentSlip} from '@/lib/order-payment-slip';
import {OrderSlipUpload} from './order-slip-upload';
const actorForRequest=cache(async()=>{try{return await currentAccount();}catch(error){if(error instanceof Error&&error.message==='UNAUTHORIZED')return null;throw error;}});
const slipForRequest=cache(readOrderPaymentSlip);
export async function OrderPaymentEvidence({orderId,slipUrl,english=false}:{orderId?:string;slipUrl?:string|null;english?:boolean}){
 const saved=orderId?await slipForRequest(orderId):null,url=slipUrl??saved?.url;
 const actor=orderId&&!url?await actorForRequest():null;
 const order=actor&&orderId?await db.orderIntake.findUnique({where:{id:orderId},select:{sellerUsername:true,status:true}}):null;
 return <aside className="order-payment-evidence" aria-label={english?'Transfer slip':'สลิปการโอนเงิน'}>
  <strong>{english?'Transfer slip':'สลิปการโอนเงิน'}</strong>
  {url?<a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={english?'Transfer slip':'สลิปการโอนเงิน'} loading="lazy"/><span>{english?'Enlarge slip':'กดขยายสลิป'}</span></a>:<>
   <p className="notice">{english?'No slip attached':'ยังไม่ได้แนบสลิป'}</p>
   {actor&&order&&canAttachPaymentSlip(actor,order)&&!['CANCELLED','WITHDRAWN','EXPIRED','RETURNED'].includes(order.status)&&<OrderSlipUpload orderId={orderId!}/>}
  </>}
 </aside>;
}
