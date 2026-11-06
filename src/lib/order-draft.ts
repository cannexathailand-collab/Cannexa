import {moneySatang,normalizeAddress} from './shipment-matching';
export function differentDraftAddress(incoming:string,stored:string){return !!incoming.trim()&&!!stored.trim()&&normalizeAddress(incoming)!==normalizeAddress(stored);}
export const draftFields={seller:'รหัสผู้ขาย',recipient:'ชื่อผู้รับ',phone:'เบอร์โทร',address:'ที่อยู่',products:'สินค้า',payment:'ชำระเงิน',amount:'ยอดตามข้อความ',customerCode:'รหัสลูกค้า'} as const;
export type OrderDraft=Record<keyof typeof draftFields,string>;
export const defaultOrderTemplate=Object.values(draftFields).map(label=>label+': {{'+label+'}}').join('\n');
export const emptyOrderDraft:OrderDraft={seller:'',recipient:'',phone:'',address:'',products:'',payment:'',amount:'',customerCode:''};
const aliases={seller:'รหัสผู้ขาย|ผู้ขาย',recipient:'ชื่อผู้รับ|ผู้รับ|ชื่อลูกค้า|ชื่อ',phone:'เบอร์โทร|โทรศัพท์|โทร|เบอร์',address:'ที่อยู่จัดส่ง|ที่อยู่ผู้รับ|ที่อยู่',products:'รายการสินค้า|สินค้า|สั่งซื้อ',payment:'วิธีชำระเงิน|ชำระเงิน',amount:'ยอดตามข้อความ|ยอดรวม|รวมทั้งสิ้น|ยอดโอน|ยอดเงิน|ยอดชำระ|ยอด',customerCode:'รหัสลูกค้า'};
export function extractOrderDraft(text:string):Partial<OrderDraft>{
 const lines=text.replace(/\r/g,'').replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-3664)).split('\n').map(r=>r.trim()).filter(Boolean),out:Partial<OrderDraft>={};
 let multiline:'address'|'products'|null=null;
 for(const line of lines){
  let found=false;
  for(const [key,label] of Object.entries(aliases)){
   const match=line.match(new RegExp('^(?:'+label+')\\s*[:：=]\\s*(.*)$','i'));if(!match)continue;
   out[key as keyof OrderDraft]=match[1].trim();multiline=key==='address'||key==='products'?key:null;found=true;break;
  }
  if(!found&&multiline)out[multiline]=(out[multiline]?out[multiline]+'\n':'')+line;
 }
 if(!out.phone){const phone=lines.flatMap(line=>line.replace(/[\s()-]/g,'').match(/(?<!\d)(?:\+?66\d{8,9}|0\d{8,9})(?!\d)/g)??[])[0];if(phone)out.phone=phone;}
 const inline=lines.find(line=>/(?:โทร|เบอร์|tel)\s*[:：]?\s*(?:\+?66|0)\d/i.test(line));
 if(inline){
  const beforePhone=inline.replace(/\s*(?:เบอร์โทร|โทรศัพท์|โทร|เบอร์|tel)\s*[:：]?\s*(?:\+?66|0)[\d\s()-]+.*$/i,'').replace(/^(?:ส่ง(?:ถึง)?|จัดส่ง(?:ให้)?)\s*/,'').trim();
  const split=beforePhone.search(/(?:^|\s)\d{1,6}(?:\/\d{1,6})?(?=\s)/);
  if(split>0){if(!out.recipient)out.recipient=beforePhone.slice(0,split).trim();if(!out.address)out.address=beforePhone.slice(split).trim();}
 }
 for(const line of lines){
  const payment=line.match(/^(COD|เก็บเงินปลายทาง|โอน)\s*[:：=]?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:บาท)?$/i);
  if(payment){if(!out.payment)out.payment=payment[1].toUpperCase()==='COD'||payment[1]==='เก็บเงินปลายทาง'?'COD':'โอน';if(!out.amount)out.amount=payment[2];}
 }
 if(!out.products){const products=lines.filter(line=>/^[A-Za-z][A-Za-z0-9._-]*\s+(?:[x×*]\s*)?\d+(?:\.\d+)?\s*(?:kg|g|กรัม|กิโลกรัม|ชิ้น|กล่อง)(?:\s.*)?$/i.test(line));if(products.length)out.products=products.join('\n');}
 if(!out.recipient){const first=lines[0];if(first&&!/[:：=\d]|ที่อยู่|สินค้า|ตำบล|อำเภอ|จังหวัด|COD/i.test(first)&&first.length<100)out.recipient=first.replace(/^คุณ\s*/,'');}
 if(!out.address&&out.phone){
  const at=lines.findIndex(line=>line.replace(/\D/g,'')===out.phone!.replace(/\D/g,''));
  const isAddress=(v:string)=>/ตำบล|อำเภอ|จังหวัด|ถนน|ซอย|หมู่|กรุงเทพ|[ตอจ]\.\s|\b\d{5}\b/.test(v);
  if(at>=0){
   const before=lines.slice(0,at),nameAt=before.findIndex(line=>/^(?:ชื่อผู้รับ|ผู้รับ|ชื่อลูกค้า|ชื่อ)\s*[:：=]/.test(line)),start=nameAt>=0?nameAt+1:1;
   const prior=before.slice(start).filter(line=>!/^ผู้รับ\s*$/.test(line)).join('\n');if(isAddress(prior))out.address=prior;
   if(!out.address){const address:string[]=[];for(const line of lines.slice(at+1)){if(/^(?:สินค้า|รายการสินค้า|ยอด|ชำระ|วิธีชำระ|รหัส)|^(?:COD|โอน|เคลม)\s*$/i.test(line))break;address.push(line);}const value=address.join('\n');if(isAddress(value))out.address=value;}
  }
 }
 if(!out.customerCode){const code=text.match(/^\s*([A-Z]{1,3}\d{4})\s*$/im)?.[1];if(code)out.customerCode=code.toUpperCase();}
 if(out.payment)out.payment=/^(COD|เก็บเงินปลายทาง)$/i.test(out.payment)?'COD':/^โอน/.test(out.payment)?'โอน':/^(เคลม|เครม)$/.test(out.payment)?'เคลม':out.payment;
 else if(/\bCOD\b|เก็บเงินปลายทาง/i.test(text))out.payment='COD';
 else if(/(?:^|\n)\s*โอน\s*(?:$|\n)/.test(text))out.payment='โอน';
 if(out.amount){const value=moneySatang(out.amount.replace(/บาท/g,'').trim());if(value!==null)out.amount=(value/100).toFixed(2);}
 return out;
}
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
