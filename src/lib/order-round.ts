import {bangkokDay,dayStart,shiftDay} from './sales-dates';

export function orderRoundClosingDay(at:Date,closeMinutes:number){
 const day=bangkokDay(at);
 return +at<+dayStart(day)+closeMinutes*60000?day:shiftDay(day,1);
}

export function orderRoundBounds(day:string,closeMinutes:number){
 const end=new Date(+dayStart(day)+closeMinutes*60000);
 return {start:new Date(+end-86400000),end};
}
