import {dayStart,shiftDay,shiftMonth,DAY_MS} from './sales-dates';

export function executiveTrendRange(from:string,to:string){
 const start=from===to?from.slice(0,7)+'-01':from;
 const end=from===to?shiftDay(shiftMonth(start,1),-1):to;
 return {from:start,to:end,days:Math.round((+dayStart(end)-+dayStart(start))/DAY_MS)+1};
}
