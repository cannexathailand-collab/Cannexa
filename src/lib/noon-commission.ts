import {loadOrderRoundSettings} from './order-round-settings';
import {orderRoundBounds,orderRoundClosingDay} from './order-round';
import {db} from './db';
import {mockMode} from './config';
import {hasActualDispatch} from './sales-recognition';
export function noonCommissionWindow(at=new Date(),closeMinutes=720){
 return orderRoundBounds(orderRoundClosingDay(at,closeMinutes),closeMinutes);
}
// A display-only total for the reply. It never settles, clears, or rewrites commission balances.
export async function pendingCommissionThisRound(affiliateId:string,at=new Date(),closeMinutes?:number){
 const cutoff=closeMinutes??(await loadOrderRoundSettings()).closeMinutes;
 const {start,end}=noonCommissionWindow(at,cutoff),time={gte:start,lt:end,lte:at};
 const [friends,sales,extras]=await Promise.all([
  db.commission.findMany({where:{status:'Approved',updatedAt:time,conversion:{affiliateId,source:mockMode()?'MOCK':'LINE',status:'VERIFIED_NEW_FRIEND'}},select:{amountSatang:true}}),
  db.salesOrder.findMany({where:{affiliateId,status:'PENDING',commissionSatang:{not:null},commissionReadyAt:time}}),
  db.additionalCommission.findMany({where:{affiliateId,status:'PENDING',amountSatang:{not:null},reversedAt:null,commissionReadyAt:time}})
 ]);
 const ids=[...new Set([...sales,...extras].map(s=>s.orderId))];
 if(!ids.length)return friends.reduce((n,r)=>n+r.amountSatang,0);
 const [orders,shipments,primary]=await Promise.all([db.orderIntake.findMany({where:{id:{in:ids}}}),db.shipment.findMany({where:{orderId:{in:ids}}}),db.salesOrder.findMany({where:{orderId:{in:ids}}})]);
 const receipts=await db.codReceipt.findMany({where:{tracking:{in:shipments.map(s=>s.tracking)}}});
 const byOrder=new Map(orders.map(o=>[o.id,o])),byShipment=new Map(shipments.map(s=>[s.orderId,s])),byPrimary=new Map(primary.map(s=>[s.orderId,s])),byReceipt=new Map(receipts.map(r=>[r.tracking,r]));
 const eligible=(id:string,requireDispatch:boolean)=>{
  const o=byOrder.get(id),s=byPrimary.get(id),h=byShipment.get(id);if(!o||!s||['RETURNED','CANCELLED','WITHDRAWN','EXPIRED'].includes(o.status)||s.status==='CANCELLED'||!['โอน','COD'].includes(o.payment??''))return false;
  if(!requireDispatch&&o.payment==='โอน')return true;
  if(!h||!hasActualDispatch(h)||!s.recognizedAt||+s.recognizedAt!==+h.dispatchedAt!||s.tracking!==h.tracking)return false;
  if(o.payment!=='COD')return true;const r=byReceipt.get(h.tracking);return !!r&&r.amountSatang===s.revenueSatang&&h.codSatang===s.revenueSatang;
 };
 return friends.reduce((n,r)=>n+r.amountSatang,0)+sales.reduce((n,s)=>n+(eligible(s.orderId,false)?s.commissionSatang??0:0),0)+extras.reduce((n,s)=>n+(eligible(s.orderId,true)?s.amountSatang??0:0),0);
}
