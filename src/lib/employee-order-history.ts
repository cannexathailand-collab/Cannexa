import {orderMatchesState} from './order-management';

export function employeeOrderRange(input:{scope?:string;range?:string;q?:string}){
 return input.range==='all'||input.scope==='mine'||!!input.q?.trim()?'all':'round';
}

export function employeeOrderScope(input:{scope?:string;q?:string}){
 return input.scope==='mine'&&!input.q?.trim()?'mine':'all';
}

export function employeeHistoryPage<T extends {state:string;shipped:boolean;awaitingShipment:boolean}>(rows:T[],status:string,pageValue?:string){
 const filtered=status==='ALL'?rows:rows.filter(row=>orderMatchesState(row,status));
 const pages=Math.max(1,Math.ceil(filtered.length/25));
 const page=Math.min(pages,Math.max(1,Number.parseInt(pageValue??'1',10)||1));
 return {rows:filtered.slice((page-1)*25,page*25),count:filtered.length,page,pages};
}
