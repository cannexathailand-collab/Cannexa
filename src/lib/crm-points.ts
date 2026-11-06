export type PointRule={enabled:boolean;satangPerPoint:number;effectiveAt:Date;tierRates?:unknown};
export function purchasePoints(revenueSatang:number,at:Date,rules:PointRule[]){
 const rule=rules.filter(r=>+r.effectiveAt<=+at).sort((a,b)=>+b.effectiveAt-+a.effectiveAt)[0];
 return rule?.enabled&&!rule.tierRates&&rule.satangPerPoint>0?Math.floor(Math.max(0,revenueSatang)/rule.satangPerPoint):0;
}
