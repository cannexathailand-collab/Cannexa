export const storeOrderLabels={
 ALL:'ออเดอร์ทั้งหมด',WAITING:'เตรียมจัดส่ง',SHIPPED:'จัดส่งแล้ว',REVIEW:'ต้องตรวจสอบ',RETURNED:'ตีกลับ',
} as const;
export type StoreOrderInput={q?:string;page?:string;status?:string};
export function storeOrderFilters(input:StoreOrderInput={}){
 const status=Object.hasOwn(storeOrderLabels,input.status??'')?input.status as keyof typeof storeOrderLabels:'ALL';
 const q=(input.q??'').trim().slice(0,100);
 const page=Math.max(1,Math.min(100000,Number.parseInt(input.page??'1',10)||1));
 return {status,q,page};
}
export function storeOrderQuery(input:StoreOrderInput={}){
 const filters=storeOrderFilters(input);
 return new URLSearchParams({status:filters.status,q:filters.q,page:String(filters.page)}).toString();
}
