import type {summarizeCustomerOrders} from './customer-crm';
import {bangkokDay,shiftMonth} from './sales-dates';
export type CrmDashboardCustomer={code:string;name:string|null;tier:string;history:ReturnType<typeof summarizeCustomerOrders>['allHistory']};
export function buildCrmDashboard(input:CrmDashboardCustomer[],now=new Date(),months=12){
 const customers=[...new Map(input.map(c=>[c.code,c])).values()],today=bangkokDay(now),current=today.slice(0,7)+'-01';
 const monthly=Array.from({length:months},(_,i)=>({month:shiftMonth(current,i-months+1).slice(0,7),revenueSatang:0,profitSatang:0,missingCosts:0,purchases:0,buyers:new Set<string>()}));
 const byMonth=new Map(monthly.map(m=>[m.month,m])),groups=new Map<string,number>();
 let revenueSatang=0,profitSatang=0,missingCosts=0,purchases=0,returned=0,shipped=0,repeatCustomers=0;
 const seen=new Set<string>();
 for(const c of customers){
  groups.set(c.tier,(groups.get(c.tier)??0)+1);
  if(c.history.filter(h=>h.recognized).length>=2)repeatCustomers++;
  for(const h of c.history){
   if(seen.has(h.order.id))continue;seen.add(h.order.id);
   if(h.returned)returned++;if(h.shipped)shipped++;
   if(!h.recognized)continue;
   purchases++;revenueSatang+=h.amountSatang!;profitSatang+=h.profitSatang??0;if(h.profitSatang===null)missingCosts++;
   const month=byMonth.get(bangkokDay(h.order.eventAt).slice(0,7));
   if(month){month.revenueSatang+=h.amountSatang!;month.profitSatang+=h.profitSatang??0;month.purchases++;month.buyers.add(c.code);if(h.profitSatang===null)month.missingCosts++;}
  }
 }
 const order=['ลูกค้าใหม่','Bronze','Silver','Gold','VIP Platinum','ยังไม่เข้าเกณฑ์'];
 return {customers:customers.length,repeatCustomers,revenueSatang,profitSatang,missingCosts,purchases,returned,shipped,returnPercent:shipped?returned/shipped*100:null,monthly:monthly.map(m=>({...m,buyers:m.buyers.size})),groups:[...groups].map(([name,count])=>({name,count,percent:customers.length?count/customers.length*100:0})).sort((a,b)=>order.indexOf(a.name)-order.indexOf(b.name))};
}
export type CrmDashboardData=ReturnType<typeof buildCrmDashboard>;
