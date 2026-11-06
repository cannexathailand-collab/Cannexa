const levels=['ยังไม่เข้าเกณฑ์','Bronze','Silver','Gold','VIP Platinum'];
const rank=(level:string)=>Math.max(0,levels.indexOf(level));
export function membershipDecision(previous:{level:string;failedMonths:number},qualified:string,currentPasses:boolean,pendingCosts=false){
 if(pendingCosts)return {...previous,failedMonths:0,decision:'WAITING_COST'};
 if(rank(qualified)>rank(previous.level))return {level:qualified,failedMonths:0,decision:'UPGRADED'};
 if(rank(previous.level)===0)return {level:previous.level,failedMonths:0,decision:'KEPT'};
 if(currentPasses)return {level:previous.level,failedMonths:0,decision:'KEPT'};
 const failedMonths=previous.failedMonths+1;
 return failedMonths>=2?{level:levels[rank(previous.level)-1],failedMonths:0,decision:'DOWNGRADED'}:{...previous,failedMonths,decision:'FAILED_FIRST'};
}
