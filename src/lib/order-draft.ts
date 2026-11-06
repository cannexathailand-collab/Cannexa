import {moneySatang,normalizeAddress} from './shipment-matching';
import {analyzeOrderDraft} from './order-draft-parser';
export {analyzeOrderDraft} from './order-draft-parser';
export function differentDraftAddress(incoming:string,stored:string){return !!incoming.trim()&&!!stored.trim()&&normalizeAddress(incoming)!==normalizeAddress(stored);}
export const draftFields={seller:'รหัสผู้ขาย',recipient:'ชื่อผู้รับ',phone:'เบอร์โทร',address:'ที่อยู่',products:'สินค้า',payment:'ชำระเงิน',amount:'ยอดตามข้อความ',customerCode:'รหัสลูกค้า'} as const;
export type OrderDraft=Record<keyof typeof draftFields,string>;
export const defaultOrderTemplate=Object.values(draftFields).map(label=>label+': {{'+label+'}}').join('\n');
export const emptyOrderDraft:OrderDraft={seller:'',recipient:'',phone:'',address:'',products:'',payment:'',amount:'',customerCode:''};
export function extractOrderDraft(text:string):Partial<OrderDraft>{return analyzeOrderDraft(text).fields;}
export function renderOrderDraft(template:string,draft:OrderDraft){
 return template.replace(/\{\{([^{}]+)\}\}/g,(_,label:string)=>{
  const key=(Object.keys(draftFields) as (keyof OrderDraft)[]).find(k=>draftFields[k]===label.trim());
  return key?(key==='address'?draft[key].trim().replace(/\n+/g,' '):draft[key].trim()):'';
 }).trimEnd();
}
export function orderDraftIssues(draft:OrderDraft){
 const issues:string[]=[];
 for(const key of ['seller','recipient','phone','address','products'] as const)if(!draft[key].trim())issues.push('กรอก'+draftFields[key]);
 if(draft.phone){const digits=draft.phone.replace(/[\s()+-]/g,'');if(!/^(0\d{8,9}|66\d{8,9})$/.test(digits))issues.push('ตรวจสอบเบอร์โทร');}
 if(!['COD','โอน','เคลม'].includes(draft.payment))issues.push('เลือกวิธีชำระเงิน');
 const amount=moneySatang(draft.amount);if(amount===null||(draft.payment!=='เคลม'&&amount<=0))issues.push('กรอกยอดเงินให้ถูกต้อง');
 return issues;
}
