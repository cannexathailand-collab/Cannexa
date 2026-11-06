import {db,transaction} from './db';
import {pendingCommissionThisRound} from './noon-commission';
import {loadCustomerCrm} from './customer-crm';
import {ensureMonthlyMemberships} from './crm-membership-monthly';
import {bangkokDay} from './sales-dates';
export type OrderReplyContext={pendingSatang:number|null;membership:string|null;points:number|null};
export async function loadOrderReplyContext(order:{affiliateId:string|null;customerCode:string|null},at=new Date()):Promise<OrderReplyContext>{
 const customer=async()=>{
  if(!order.customerCode)return {membership:null,points:null};
  const code=order.customerCode,month=bangkokDay(at).slice(0,7);
  let review=await db.crmMembershipReview.findUnique({where:{customerCode_month:{customerCode:code,month}}});
  if(!review){await transaction(tx=>ensureMonthlyMemberships(tx,at));review=await db.crmMembershipReview.findUnique({where:{customerCode_month:{customerCode:code,month}}});}
  const summary=(await loadCustomerCrm([code])).get(code);
  return {membership:review?.level??null,points:summary?.lifetimePoints??null};
 };
 const [pendingSatang,info]=await Promise.all([order.affiliateId?pendingCommissionThisRound(order.affiliateId,at):Promise.resolve(null),customer()]);
 return {pendingSatang,...info};
}
