import {moneySatang} from './shipment-matching';
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
 if(!out.phone){const phone=lines.join(' ').match(/(?:\+?66|0)[\d -]{7,15}\d/g)?.find(v=>/^(0\d{8,9}|66\d{8,9})$/.test(v.replace(/\D/g,'')));if(phone)out.phone=phone.replace(/[ -]/g,'');}
 if(!out.recipient){const first=lines[0];if(first&&!/[:：=\d]|ที่อยู่|สินค้า|ตำบล|อำเภอ|จังหวัด|COD/i.test(first)&&first.length<100)out.recipient=first.replace(/^คุณ\s*/,'');}
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
