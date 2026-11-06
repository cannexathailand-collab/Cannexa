import type {ExpenseEntry} from './expense-report';
const groups=[{key:'PRODUCT_COST',label:'ต้นทุนสินค้า',color:'#1f8a70'},{key:'FREIGHT',label:'ค่าขนส่ง',color:'#e7a63b'},{key:'COMMISSION',label:'ค่าคอมมิชชัน',color:'#548bd1'},{key:'RECURRING',label:'รายจ่ายประจำ',color:'#9b78cf'},{key:'LINE',label:'รายจ่ายอื่นจาก LINE',color:'#df7f85'}];
export function expenseBreakdown(entries:Pick<ExpenseEntry,'kind'|'amountSatang'>[]){
 const amounts=new Map<string,number>();let creditsSatang=0;
 for(const entry of entries){if(entry.amountSatang<0){creditsSatang-=entry.amountSatang;continue;}const key=['FRIEND','SALE'].includes(entry.kind)?'COMMISSION':entry.kind;amounts.set(key,(amounts.get(key)??0)+entry.amountSatang);}
 const grossSatang=[...amounts.values()].reduce((n,v)=>n+v,0);let offset=0;
 const slices=groups.map(group=>{const amountSatang=amounts.get(group.key)??0,percent=grossSatang?amountSatang/grossSatang*100:0;const slice={...group,amountSatang,percent,offset};offset+=percent;return slice;}).filter(s=>s.amountSatang>0);
 return {slices,grossSatang,creditsSatang,netSatang:grossSatang-creditsSatang};
}
