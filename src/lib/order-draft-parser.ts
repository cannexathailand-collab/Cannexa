import type {OrderDraft} from './order-draft';
import {moneySatang} from './shipment-matching';
type Key=keyof OrderDraft;
export type DraftAnalysis={fields:Partial<OrderDraft>;issues:Partial<Record<Key,string>>};
const labels:Record<Key,string>={seller:'รหัสผู้ขาย|ผู้ขาย|seller',recipient:'ชื่อผู้รับ|ชื่อผู้ซื้อ|ผู้รับ|ชื่อลูกค้า|ชื่อ|recipient|customer name|name',phone:'เบอร์โทรศัพท์|เบอร์โทร|เบอร์มือถือ|โทรศัพท์|มือถือ|โทร|เบอร์|phone|tel',address:'ที่อยู่จัดส่ง|ที่อยู่ผู้รับ|ที่อยู่|address',products:'รายการสินค้า|สินค้า|สั่งซื้อ|products?|items?',payment:'วิธีชำระเงิน|ชำระเงิน|การชำระเงิน|payment',amount:'ยอดตามข้อความ|ยอดรวมสุทธิ|ยอดรวม|รวมทั้งสิ้น|ยอดโอน|ยอดเงิน|ยอดชำระ|ยอดสุทธิ|ยอด|total|amount',customerCode:'รหัสลูกค้า|customer code'};
const heading=Object.values(labels).join('|');
const productPattern=/^[A-Za-z][A-Za-z0-9._-]*\s*(?:[x×*]\s*)?\d+(?:\.\d+)?\s*(?:kg|g|กรัม|กิโลกรัม|ชิ้น|กล่อง)(?:\s.*)?$/i;
const metadata=/^(?:L\.|LINE\s*[:.]|ไลน์\s*[:：]|ผู้รับ\s*$|ผู้ส่ง\s*$|หมายเหตุ\s*[:：]|ขอบคุณ|ฝาก|รบกวน)/i;
const politeOnly=/^(?:(?:ครับ|ผม|ค่ะ|คะ|จ้า|จ้ะ|นะ|ด้วย|ขอบคุณ|thank you|thanks|please)[\s!,.🙏]*)+$/i;
const addressSignal=/บ้านเลขที่|เลขที่|ตำบล|อำเภอ|จังหวัด|แขวง|เขต|ถนน|ซอย|หมู่|กรุงเทพ|[ตอจถซม]\.\s*|\b\d{5}\b|\b(?:village|road|street|soi|lane|avenue|district|province|building|apartment|tambon|amphoe|thailand)\b/i;
const phonePattern=/(?<!\d)(?:\+?66(?:0)?\d{8,9}|0\d{8,9})(?!\d)/g;
const paymentPattern=/^(C[.\s]*O[.\s]*D\.?|เก็บเงินปลายทาง|เก็บปลายทาง|ปลายทาง|โอนแล้ว|โอนเงิน|โอน|เคลม|เครม|claim)(?:\s*[.:=\-]?\s*฿?\s*([\d,]+(?:\.\d{1,2})?)(?:\.-)?\s*(?:บาท|฿)?)?\s*[.:]?$/i;
function normalizePhone(value:string){const digits=value.replace(/\D/g,'');return digits.startsWith('660')?'0'+digits.slice(3):digits.startsWith('66')?'0'+digits.slice(2):digits;}
function phones(line:string){return line.replace(/[\s()-]/g,'').match(phonePattern)?.map(normalizePhone)??[];}
function payment(value:string){return /^(?:COD|(?:เก็บ(?:เงิน)?)?ปลายทาง)$/i.test(value.replace(/[.\s]/g,''))?'COD':/^โอน|transfer|bank transfer$/i.test(value)?'โอน':/เคลม|เครม|claim/i.test(value)?'เคลม':value.trim();}
function cleanMoney(value:string){return moneySatang(value.replace(/บาท|฿|THB/gi,'').replace(/\.-$/,'').trim());}
function cleanPrefix(line:string){return line.replace(/^(?:ส่ง(?:ถึง)?|จัดส่ง(?:ให้)?|ผู้รับ)\s*[:：]?\s*/,'').trim();}
export function analyzeOrderDraft(text:string):DraftAnalysis{
 const normalized=text.normalize('NFKC').replace(/\u0E4D\u0E32/g,'ำ').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\r\n?/g,'\n').replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-3664))
  .replace(new RegExp('\\s+(?=(?:'+heading+')\\s*[:=])','gi'),'\n');
 const lines:string[]=[],groups:number[]=[];let group=0;
 for(const raw of normalized.split('\n')){const line=raw.trim().replace(/^[•▪●✅📦📍☎️📞]+\s*/u,'').replace(/^[-*]\s+/,'');if(!line){group++;continue;}lines.push(line);groups.push(group);}
 const fields:Partial<OrderDraft>={},issues:DraftAnalysis['issues']={},values=new Map<Key,string[]>(),used=new Set<number>(),free:string[]=[],freeGroups:number[]=[],freeIndices:number[]=[];
 const add=(key:Key,value:string)=>{if(value.trim())values.set(key,[...(values.get(key)??[]),value.trim()]);};
 let block:{key:'address'|'products';value:string[]}|null=null,pending:Key|null=null;
 const finish=()=>{if(block){add(block.key,block.value.join('\n'));block=null;}};
 for(const [index,line] of lines.entries()){
  let found=false;
  for(const [key,aliases] of Object.entries(labels) as [Key,string][]){
   const m=line.match(new RegExp('^(?:'+aliases+')(?:\\s*[:=\\-]\\s*|\\s+)(.*)$','i'))??(new RegExp('^(?:'+aliases+')$','i').test(line)?['','']:null);
   if(!m)continue;finish();pending=null;used.add(index);found=true;
   if(key==='address'||key==='products')block={key,value:m[1]?[m[1]]:[]};else if(m[1])add(key,m[1]);else pending=key;break;
  }
  if(found)continue;
  if(pending){add(pending,line);pending=null;used.add(index);continue;}
  const special=productPattern.test(line)||phones(line).length>0||paymentPattern.test(line)||metadata.test(line)||/^[A-Z]{1,3}\d{4}$/i.test(line);
  if(block&&!special){block.value.push(line);used.add(index);}else{if(block)finish();}
 }
 finish();
 // Classify independent entities before inferring names and addresses; their order is irrelevant.
 const phoneValues:string[]=[],products:string[]=[];let segment=0,previousGroup=-1;
 for(const [index,line] of lines.entries()){
  if(groups[index]!==previousGroup){segment++;previousGroup=groups[index];}
  if(used.has(index)){segment++;continue;}
  if(metadata.test(line)){used.add(index);segment++;continue;}
  const pay=line.match(paymentPattern);if(pay){add('payment',pay[1]);if(pay[2])add('amount',pay[2]);used.add(index);segment++;continue;}
  const suffixPay=line.match(/^฿?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:บาท)?\s*(C[.\s]*O[.\s]*D\.?|โอน)$/i);if(suffixPay){add('payment',suffixPay[2]);add('amount',suffixPay[1]);used.add(index);segment++;continue;}
  if(productPattern.test(line)){products.push(line);used.add(index);segment++;continue;}
  if(/^[A-Z]{1,3}\d{4}$/i.test(line)){add('customerCode',line.toUpperCase());used.add(index);segment++;continue;}
  const matches=phones(line);phoneValues.push(...matches);
  let remaining=line;
  if(matches.length){remaining=line.replace(/(?:เบอร์โทรศัพท์|เบอร์โทร|โทรศัพท์|โทร|เบอร์|phone|tel)?\s*[:=]?\s*(?:\+?66(?:0)?|0)[\d\s()-]{7,}/i,'').trim();if(!remaining){used.add(index);segment++;continue;}}
  remaining=cleanPrefix(remaining);if(politeOnly.test(remaining)){used.add(index);segment++;continue;}if(remaining){free.push(remaining);freeGroups.push(segment);freeIndices.push(index);}
 }
 if(products.length)add('products',products.join('\n'));
 if(!values.has('phone'))for(const phone of phoneValues)add('phone',phone);
 else if(phoneValues.length)for(const phone of phoneValues)add('phone',phone);
 // Split inline "name house-number address" without assuming the phone is at either end.
 const addressParts:string[]=[],nameCandidates:string[]=[];
 const explicitRecipient=values.has('recipient');
 const addName=(line:string)=>{if(!/[\d:=]/.test(line)&&line.length<100&&!/^(?:COD|โอน|เคลม|เครม|ที่อยู่|สินค้า)$/i.test(line))nameCandidates.push(line.replace(/^คุณ\s*/,''));};
 for(const groupId of new Set(freeGroups)){
  let block=free.filter((_,index)=>freeGroups[index]===groupId);const rawIndices=freeIndices.filter((_,index)=>freeGroups[index]===groupId),marker=block.findIndex(line=>addressSignal.test(line)||/^\d{1,6}(?:\/\d{1,6})?\s/.test(line));
  if(explicitRecipient&&marker>=0){addressParts.push(...block);continue;}
  const last=block.at(-1)!;
  if(marker===0&&block.length>1&&!/[\d:=]/.test(last)&&!addressSignal.test(last)&&phones(lines[(rawIndices.at(-1)??0)+1]??'').length){addName(last);block=block.slice(0,-1);}
  for(const [index,line]of block.entries()){
   if(marker<0||index<marker){addName(line);continue;}
   const split=index===marker?line.search(/(?:^|\s)\d{1,6}(?:\/\d{1,6})?(?=\s)/):-1;
   if(split>0&&!addressSignal.test(line.slice(0,split))&&addressSignal.test(line.slice(split))){addName(line.slice(0,split).trim());addressParts.push(line.slice(split).trim());}
   else addressParts.push(line);
  }
 }
 if(!explicitRecipient&&nameCandidates.length===1)add('recipient',nameCandidates[0]);
 if(!values.has('address')&&addressParts.length&&addressSignal.test(addressParts.join(' ')))add('address',addressParts.join('\n'));
 for(const [key,candidates] of values){
  const converted=candidates.map(v=>key==='phone'?normalizePhone(v):key==='payment'?payment(v):key==='amount'?(cleanMoney(v)===null?v:(cleanMoney(v)!/100).toFixed(2)):key==='customerCode'?v.toUpperCase():v);
  const unique=[...new Set(converted)];
  if(unique.length>1&&!['products'].includes(key)){fields[key]='';issues[key]='พบข้อมูล'+({seller:'ผู้ขาย',recipient:'ชื่อผู้รับ',phone:'เบอร์โทร',address:'ที่อยู่',payment:'วิธีชำระเงิน',amount:'ยอดเงิน',customerCode:'รหัสลูกค้า',products:'สินค้า'}[key])+'มากกว่าหนึ่งค่า กรุณาเลือกให้ถูกต้อง';}
  else fields[key]=key==='products'?converted.join('\n'):unique[0];
 }
 if(!fields.recipient&&nameCandidates.length>1)issues.recipient='พบชื่อที่เป็นไปได้หลายค่า กรุณาระบุชื่อผู้รับ';
 return {fields,issues};
}
