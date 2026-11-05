export const DAY_MS=86400000;
export function bangkokDay(date:Date){return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);}
export function dayStart(day:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error("INVALID_DATE_RANGE");
 const date=new Date(day+"T00:00:00+07:00");if(!Number.isFinite(+date)||bangkokDay(date)!==day)throw Error("INVALID_DATE_RANGE");return date;
}
export function shiftDay(day:string,days:number){return bangkokDay(new Date(+dayStart(day)+days*DAY_MS));}
export function shiftMonth(day:string,months:number){const [y,m,d]=day.split("-").map(Number);const first=new Date(Date.UTC(y,m-1+months,1));const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();return `${first.getUTCFullYear()}-${String(first.getUTCMonth()+1).padStart(2,"0")}-${String(Math.min(d,last)).padStart(2,"0")}`;}
export function salesRange(input:{from?:string;to?:string;month?:string},now=new Date()){
 const today=bangkokDay(now),month=input.month&&/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)?input.month:today.slice(0,7);
 const last=shiftDay(shiftMonth(month+"-01",1),-1);
 const from=input.from??month+"-01",to=input.to??(month===today.slice(0,7)?today:last);dayStart(from);dayStart(to);if(from>to)throw Error("INVALID_DATE_RANGE");return {from,to};
}
export function compareRevenue(current:number,base:number){return {base,difference:current-base,percent:base===0?null:(current-base)/base*100};}
export function parseDispatchTime(input:string){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input))throw Error("INVALID_DISPATCH_TIME");const date=new Date(input+":00+07:00");if(!Number.isFinite(+date)||bangkokDay(date)!==input.slice(0,10)||date.getTime()>Date.now()+300000||date.getUTCFullYear()<2000)throw Error("INVALID_DISPATCH_TIME");const local=new Date(+date+7*3600000).toISOString().slice(0,16);if(local!==input)throw Error("INVALID_DISPATCH_TIME");return date;}
