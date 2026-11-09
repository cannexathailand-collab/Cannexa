import {db} from './db';

export function orderTeamName(groupKey:string|null|undefined,names:ReadonlyMap<string,string>){
 return groupKey==='website'?'เว็บไซต์':names.get(groupKey??'')?.trim()||'ยังไม่ระบุทีม';
}
export async function loadOrderTeamNames(groupKeys:string[]){
 const keys=[...new Set(groupKeys.filter(key=>key&&key!=='website'))];
 const groups=keys.length?await db.orderGroup.findMany({where:{id:{in:keys}},select:{id:true,name:true}}):[];
 const names=new Map(groups.map(group=>[group.id,group.name]));
 return new Map([...new Set(groupKeys)].map(key=>[key,orderTeamName(key,names)]));
}
