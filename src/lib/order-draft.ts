import {moneySatang,normalizeAddress} from './shipment-matching';
import {analyzeOrderDraft} from './order-draft-parser';
export {analyzeOrderDraft} from './order-draft-parser';
export function differentDraftAddress(incoming:string,stored:string){return !!incoming.trim()&&!!stored.trim()&&normalizeAddress(incoming)!==normalizeAddress(stored);}
export function hasCompletePostalCode(address:string){
 const explicit=address.match(/(?:รหัสไปรษณีย์|ไปรษณีย์|ปณ\.?|postcode|zip(?:code)?)\s*[:=]?\s*(\d+)/i);
 if(explicit)return explicit[1].length===5;
 return [...address.matchAll(/(?<!\d)\d{5}(?!\d)/g)].some(m=>{
  if(/(?:บ้านเลขที่|เลขที่)\s*$/.test(address.slice(0,m.index)))return false;
  if(m.index!==0||address.trim()===m[0])return true;
  // Postal-first locality lines use a comma; street-first house numbers do not qualify.
  return /^\d{5}\s*,\s*[A-Za-zก-๙]/.test(address)&&!/^\d{5}\s*,[^\n]*(?:บ้านเลขที่|เลขที่|ถนน|ซอย|\b(?:road|street|soi|lane|avenue)\b)/i.test(address);
 });
}
export const draftFields={seller:'รหัสผู้ขาย',recipient:'ชื่อผู้รับ',phone:'เบอร์โทร',address:'ที่อยู่',products:'สินค้า',payment:'ชำระเงิน',amount:'ยอดตามข้อความ',customerCode:'รหัสลูกค้า',points:'Green Coin'} as const;
export type OrderDraft=Record<keyof typeof draftFields,string>;
export const defaultOrderTemplate=Object.values(draftFields).map(label=>label+': {{'+label+'}}').join('\n');
export const emptyOrderDraft:OrderDraft={seller:'',recipient:'',phone:'',address:'',products:'',payment:'',amount:'',customerCode:'',points:''};
export function extractOrderDraft(text:string):Partial<OrderDraft>{return analyzeOrderDraft(text).fields;}
export function renderOrderDraft(template:string,draft:OrderDraft){
 return template.replace(/\{\{([^{}]+)\}\}/g,(_,label:string)=>{
  const key=(Object.keys(draftFields) as (keyof OrderDraft)[]).find(k=>draftFields[k]===label.trim());
  return key?(key==='address'?draft[key].trim().replace(/\n+/g,' '):key==='points'?draft[key].trim()||'—':draft[key].trim()):'';
 }).trimEnd();
}
export function orderDraftIssues(draft:OrderDraft){
 const issues:string[]=[];
 for(const key of ['seller','recipient','phone','address','products'] as const)if(!draft[key].trim())issues.push('กรอก'+draftFields[key]);
 if(draft.phone){let digits=draft.phone.replace(/[\s()+-]/g,'');if(digits.startsWith('660'))digits='0'+digits.slice(3);else if(digits.startsWith('66'))digits='0'+digits.slice(2);if(!/^0\d{9}$/.test(digits)||/^0+$/.test(digits))issues.push('เบอร์โทรต้องครบ 10 หลัก');}
 if(draft.address&&!hasCompletePostalCode(draft.address))issues.push('รหัสไปรษณีย์ต้องครบ 5 หลัก');
 if(!['COD','โอน','เคลม'].includes(draft.payment))issues.push('เลือกวิธีชำระเงิน');
 const amount=moneySatang(draft.amount);if(amount===null||(draft.payment!=='เคลม'&&amount<=0))issues.push('กรอกยอดเงินให้ถูกต้อง');
 return issues;
}
