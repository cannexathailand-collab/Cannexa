import type {ExpenseEntry} from './expense-report';
const groups=[{key:'PRODUCT_COST',label:'ต้นทุนสินค้า',color:'#cc7e88'},{key:'FREIGHT',label:'ค่าขนส่ง',color:'#e5a5ae'},{key:'COMMISSION',label:'ค่าคอมมิชชัน',color:'#efc3c9'},{key:'RECURRING',label:'รายจ่ายประจำ',color:'#b96374'},{key:'LINE',label:'รายจ่ายอื่นจาก LINE',color:'#f6dce0'}];
export function expenseBreakdown(entries:Pick<ExpenseEntry,'kind'|'amountSatang'>[]){
 const amounts=new Map<string,number>();let creditsSatang=0;
 for(const entry of entries){if(entry.amountSatang<0){creditsSatang-=entry.amountSatang;continue;}const key=['FRIEND','SALE','SPECIAL'].includes(entry.kind)?'COMMISSION':entry.kind;amounts.set(key,(amounts.get(key)??0)+entry.amountSatang);}
 const grossSatang=[...amounts.values()].reduce((n,v)=>n+v,0);let offset=0;
 const slices=groups.map(group=>{const amountSatang=amounts.get(group.key)??0,percent=grossSatang?amountSatang/grossSatang*100:0;const slice={...group,amountSatang,percent,offset};offset+=percent;return slice;}).filter(s=>s.amountSatang>0);
 return {slices,grossSatang,creditsSatang,netSatang:grossSatang-creditsSatang};
}
