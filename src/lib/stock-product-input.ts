import {z} from 'zod';
const number=(max:number,precision:number)=>z.union([z.number(),z.string().trim().min(1)]).pipe(z.coerce.number<string|number>().finite().min(0).max(max).refine(n=>Math.abs(n*10**precision-Math.round(n*10**precision))<0.00001));
export const newStockProduct=z.object({requestKey:z.uuid(),code:z.string().trim().toUpperCase().regex(/^[A-Z]+\d+$/).max(50),name:z.string().trim().min(1).max(200),cost:number(21474836.47,2),quantity:number(999999999,3),prices:z.array(z.object({pack:z.string().trim().min(1).max(30).regex(/^[\p{L}\p{N} ._-]+$/u),price:number(21474836.47,2)})).max(4).refine(p=>new Set(p.map(x=>x.pack.toUpperCase())).size===p.length)});
export type NewStockProduct=z.infer<typeof newStockProduct>;
export function stockSheetRow(input:NewStockProduct){return ['',input.name,input.code,input.cost,input.quantity,0,input.quantity,'Cannexa:'+input.requestKey,...input.prices.map(p=>p.pack+'/'+p.price)];}
export function latestStockTab(tabs:{sheetId:number;title:string;gridProperties?:{rowCount?:number}}[]){
 const dates=tabs.flatMap(tab=>{const match=tab.title.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);if(!match)return [];const day=Number(match[1]),month=Number(match[2]),year=match[3].length===2?Number(match[3])+1957:Number(match[3])-543;const date=new Date(Date.UTC(year,month-1,day));if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return [];return [{...tab,time:date.getTime()}];}).sort((a,b)=>b.time-a.time);
 if(!dates.length)throw new Error('STOCK_SHEET_NOT_FOUND');return dates[0];
}

