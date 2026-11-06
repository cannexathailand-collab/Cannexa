export const defaultTierSettings={vipTopPercent:20,goldTopPercent:40,silverTopPercent:70};
export type TierSettings=typeof defaultTierSettings;
export function validTierSettings(s:TierSettings){return [s.vipTopPercent,s.goldTopPercent,s.silverTopPercent].every(Number.isInteger)&&s.vipTopPercent>0&&s.vipTopPercent<s.goldTopPercent&&s.goldTopPercent<s.silverTopPercent&&s.silverTopPercent<100;}
export function assignCustomerTiers(customers:{code:string;purchasedSatang:number}[],settings:TierSettings=defaultTierSettings){
 if(!validTierSettings(settings))throw Error('INVALID_TIER_THRESHOLDS');
 const unique=[...new Map(customers.map(c=>[c.code,c])).values()],buyers=unique.filter(c=>c.purchasedSatang>0).sort((a,b)=>b.purchasedSatang-a.purchasedSatang);
 const result=new Map(unique.map(c=>[c.code,{name:'ลูกค้าใหม่',rank:null as number|null,buyers:buyers.length}]));
 let previous=-1,rank=0;
 buyers.forEach((c,index)=>{
  if(c.purchasedSatang!==previous)rank=index;
  previous=c.purchasedSatang;const topPercent=rank/buyers.length*100;
  const name=topPercent<settings.vipTopPercent?'VIP Platinum':topPercent<settings.goldTopPercent?'Gold':topPercent<settings.silverTopPercent?'Silver':'Bronze';
  result.set(c.code,{name,rank:rank+1,buyers:buyers.length});
 });
 return result;
}
