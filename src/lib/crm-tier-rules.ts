import {z} from 'zod';
export const tierNames={bronze:'Bronze',silver:'Silver',gold:'Gold',vip:'VIP Platinum'} as const;
export const tierKeys=['bronze','silver','gold','vip'] as const;
export const tierMetrics=[
 ['spend','ยอดซื้อสำเร็จสะสม','บาท'],
 ['profit','กำไรสะสมหลังต้นทุนสินค้าและค่าส่ง','บาท'],
 ['monthlyProfit','กำไรสะสมเดือนปัจจุบันหลังต้นทุนสินค้าและค่าส่ง','บาท'],
 ['monthlySpend','ยอดซื้อเฉลี่ยต่อเดือน','บาท/เดือน'],
 ['frequency','จำนวนครั้งที่ซื้อเฉลี่ยต่อเดือน','ครั้ง/เดือน'],
 ['gap','ระยะห่างเฉลี่ยระหว่างการซื้อ','วัน'],
 ['points','แต้มสะสม','แต้ม'],
 ['purchases','จำนวนครั้งที่ซื้อสำเร็จ','ครั้ง'],
 ['topPercent','อันดับยอดซื้อ: กลุ่มบน','%'],
] as const;
const conditionSchema=z.object({metric:z.enum(['spend','profit','monthlyProfit','monthlySpend','frequency','gap','points','purchases','topPercent']),operator:z.enum(['gte','lte']),value:z.number().finite().min(0).max(1e12)}).refine(c=>c.metric!=='topPercent'||c.value>0&&c.value<=100,{message:'อันดับกลุ่มบนต้องมากกว่า 0 และไม่เกิน 100'});
export const tierRuleSchema=z.object({tier:z.enum(tierKeys),enabled:z.boolean(),required:z.object({monthlySpend:z.number().finite().min(0.01).max(1e12),monthlyProfit:z.number().finite().min(-1e12).max(1e12),membershipDays:z.number().int().min(0).max(100000),monthlyPurchases:z.number().int().min(1).max(1000000)}),match:z.enum(['all','any']),conditions:z.array(conditionSchema).max(10)});
export type TierRule=z.infer<typeof tierRuleSchema>;
export type TierMetricValues={spend:number;profit:number|null;monthlyProfit:number|null;monthlySpend:number;frequency:number;gap:number|null;points:number;purchases:number;topPercent:number;monthlySpendActual:number;monthlyPurchases:number;membershipDays:number};
export function defaultTierRules(settings:{vipTopPercent:number;goldTopPercent:number;silverTopPercent:number}):TierRule[]{
 return tierKeys.map(tier=>({tier,enabled:true,required:{monthlySpend:0.01,monthlyProfit:0,membershipDays:0,monthlyPurchases:1},match:'all',conditions:tier==='bronze'?[]:[{metric:'topPercent',operator:'lte',value:tier==='vip'?settings.vipTopPercent:tier==='gold'?settings.goldTopPercent:settings.silverTopPercent}]}));
}
export function resolveTierRules(settings:{vipTopPercent:number;goldTopPercent:number;silverTopPercent:number;rules?:unknown}){
 if(settings.rules===null||settings.rules===undefined)return defaultTierRules(settings);
 const parsed=z.array(tierRuleSchema).length(4).safeParse(settings.rules);
 if(!parsed.success||new Set(parsed.data.map(r=>r.tier)).size!==4)throw Error('INVALID_TIER_RULES');
 return parsed.data.map(rule=>({...rule,match:'all' as const}));
}
export function matchesTierRule(rule:TierRule,values:TierMetricValues){
 if(!rule.enabled)return false;
 if(values.monthlySpendActual<rule.required.monthlySpend||values.monthlyProfit===null||values.monthlyProfit<rule.required.monthlyProfit||values.monthlyPurchases<rule.required.monthlyPurchases||values.membershipDays<rule.required.membershipDays)return false;
 if(!rule.conditions.length)return true;
 const matches=rule.conditions.map(c=>{
  const value=values[c.metric];if(value===null)return false;
  if(c.metric==='topPercent')return value<c.value;
  return c.operator==='gte'?value>=c.value:value<=c.value;
 });
 return matches.every(Boolean);
}
