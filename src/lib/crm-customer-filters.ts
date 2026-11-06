export const crmFilterFields=[['spend','ยอดซื้อสะสม (บาท)'],['profit','กำไรสะสม (บาท)'],['points','แต้มสะสม'],['monthly','ยอดซื้อเฉลี่ยต่อเดือน (บาท)'],['frequency','ความถี่ซื้อเฉลี่ย (ครั้ง/เดือน)'],['gap','ระยะห่างเฉลี่ย (วัน)']] as const;
export type CrmCustomerFilters=Record<string,string|undefined>;
export type CrmCustomerMetrics={code:string;spend:number;profit:number|null;points:number;monthly:number;frequency:number;gap:number|null};
export function filterAndSortCustomers<T extends CrmCustomerMetrics>(rows:T[],filters:CrmCustomerFilters){
 const bounds=crmFilterFields.map(([field])=>{
  const parse=(key:string)=>{const raw=filters[key]?.trim();if(!raw)return undefined;const value=Number(raw);if(!Number.isFinite(value))throw Error('INVALID_CRM_FILTER');return value;};
  return {field,min:parse(field+'Min'),max:parse(field+'Max')};
 });
 const included=rows.filter(row=>bounds.every(({field,min,max})=>{
  const value=row[field];return min===undefined&&max===undefined||value!==null&&(min===undefined||value>=min)&&(max===undefined||value<=max);
 }));
 const sort=filters.sort??'frequencyDesc';
 const column: keyof Omit<CrmCustomerMetrics,'code'>=sort==='spendDesc'?'spend':sort==='profitDesc'?'profit':sort==='pointsDesc'?'points':sort==='monthlyDesc'?'monthly':sort==='gapAsc'?'gap':'frequency';
 return included.sort((a,b)=>{
  const av=a[column],bv=b[column];if(av===null||bv===null)return av===bv?a.code.localeCompare(b.code):av===null?1:-1;
  return (column==='gap'?av-bv:bv-av)||b.spend-a.spend||a.code.localeCompare(b.code);
 });
}
