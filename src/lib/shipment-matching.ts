import {contactPhones} from './contact-phones';
export const normalizeName=(v:string)=>v.normalize("NFKC").replace(/\s/g,"").toLowerCase();
export const normalizePhone=(v:string)=>{const n=v.replace(/\D/g,"");return n.startsWith("66")?"0"+n.slice(2):n;};
export const phonesMatch=(first:string,second:string)=>contactPhones(first).some(phone=>/^0\d{8,9}$/.test(phone)&&contactPhones(second).includes(phone));
export const normalizeAddress=(v:string)=>v.normalize("NFKC").replace(/ตําบล|ตำบล|อำเภอ|จังหวัด|หมู่ที่|หมู่|ต\.|อ\.|จ\./g,"").replace(/[\s,.-]/g,"").toLowerCase();
export function moneySatang(value:string|number){const v=String(value).replace(/[,฿\s]/g,"");if(!/^\d+(?:\.\d{1,2})?$/.test(v))return null;const [whole,fraction=""]=v.split(".");const n=Number(whole)*100+Number(fraction.padEnd(2,"0"));return Number.isSafeInteger(n)&&n<=2147483647?n:null;}
export function quotedTotal(text:string){const values=text.split(/\r?\n/).map(line=>line.match(/^\s*(?:ยอดตามข้อความ|ยอดรวม|รวมทั้งสิ้น|ยอดโอน|โอน|COD)\s*[:=：]\s*([\d,.]+)\s*(?:บาท|฿)?\s*$/i)).filter(Boolean);return values.length===1?moneySatang(values[0]![1]):null;}
export type MatchOrder={eventAt?:Date;id:string;affiliateId:string|null;recipient:string|null;phone:string|null;address:string|null;rawText:string|null;payment:string|null};
export type MatchShipment={recipient:string;phone:string;address:string;codSatang:number};
export function shipmentCandidates(shipment:MatchShipment,orders:MatchOrder[]){
 if(shipment.codSatang<=0||!shipment.recipient||!shipment.phone||!shipment.address)return [];
 return orders.filter(o=>o.affiliateId&&o.recipient&&o.phone&&o.address&&o.rawText&&o.payment==="COD"&&normalizeName(o.recipient)===normalizeName(shipment.recipient)&&phonesMatch(o.phone,shipment.phone)&&normalizeAddress(o.address)===normalizeAddress(shipment.address)&&quotedTotal(o.rawText)===shipment.codSatang);
}
export function transferShipmentCandidates(shipment:MatchShipment,orders:MatchOrder[]){
 if(shipment.codSatang!==0||!shipment.recipient||!shipment.phone||!shipment.address)return [];
 return orders.filter(o=>o.affiliateId&&o.payment==="โอน"&&o.recipient&&o.phone&&o.address&&normalizeName(o.recipient)===normalizeName(shipment.recipient)&&phonesMatch(o.phone,shipment.phone)&&normalizeAddress(o.address)===normalizeAddress(shipment.address));
}
export function nonCodShipmentCandidates(shipment:MatchShipment,orders:MatchOrder[]){
 if(shipment.codSatang!==0||!shipment.recipient||!shipment.phone||!shipment.address)return [];
 return orders.filter(o=>o.affiliateId&&(o.payment==="โอน"||o.payment==="เคลม")&&o.recipient&&o.phone&&o.address&&phonesMatch(o.phone,shipment.phone)&&comparableRecipient(o.recipient)===comparableRecipient(shipment.recipient)&&compatibleAddress(o.address,shipment.address));
}
function comparableRecipient(value:string){
 const withoutLabel=value.trim().replace(/^(?:ส่ง(?:ถึง)?|เรียน)\s*(?=คุณ|นาย|นาง|น\.?ส\.?)/,'');
 const name=normalizeName(withoutLabel.replace(/^(?:คุณ|นาย|นางสาว|นาง|น\.?\s*ส\.?|(?:mr|mrs|ms|miss)\.?\s+)/i,'').replace(/[.,]/g,''));
 // A narrowly defined English nickname spelling variant, not general fuzzy names.
 return /^[a-z]{3,}$/.test(name)?name.replace(/ie$/, "y"):name;
}
function structuredThaiAddress(value:string){
 const tokens=value.normalize("NFKC").replace(/ตําบล|ตำบล|อำเภอ|จังหวัด|ต\.|อ\.|จ\./g,"").trim().split(/\s+/).map(normalizeAddress).filter(Boolean);
 if(!/^\d+(?:[/-]\d+)*$/.test(tokens[0]??""))return null;
 const postalIndex=tokens.findIndex(t=>/^\d{5}$/.test(t));if(postalIndex<1)return null;
 const province=tokens[postalIndex-1];if(!/^[ก-๙]+$/.test(province))return null;
 const postcodes=new Set(tokens.filter(t=>/^\d{5}$/.test(t)));if(postcodes.size!==1)return null;
 return [...new Set(tokens.map(t=>t==="เมือง"+province?"เมือง":t))].join("|");
}
export function compatibleAddress(first:string,second:string){
 const canonical=(value:string)=>value.replace(/กรุงเทพมหานคร|กรุงเทพฯ|กทม\.?/g,'กรุงเทพ');
 const a=normalizeAddress(canonical(first)),b=normalizeAddress(canonical(second));if(a===b)return !!a;
 const structuredFirst=structuredThaiAddress(first),structuredSecond=structuredThaiAddress(second);
 if(structuredFirst&&structuredSecond&&structuredFirst===structuredSecond)return true;
 const [short,long]=a.length<=b.length?[a,b]:[b,a];
 // Accept a substantial complete address prefix with a house/unit number.
 // Never equate house 28 with 280, or unit 28 with 28/1.
 return short.length>=20&&/\d/.test(short)&&long.startsWith(short)&&!(/[\d/]$/.test(short)&&/^[\d/]/.test(long.slice(short.length)));
}
function namedLocationWithExactFullName(order:MatchOrder,shipment:MatchShipment){
 if(!order.recipient||!order.address||normalizeName(order.recipient)!==normalizeName(shipment.recipient)||normalizeName(order.recipient).length<10)return false;
 if(!/^\p{L}{2,}(?:\s+\p{L}{2,})+$/u.test(order.recipient.trim()))return false;
 const short=order.address.trim().toLowerCase().split(/\s+/),long=shipment.address.trim().toLowerCase().split(/\s+/);
 if(short.length<3||short.join("").length<15||!short.every(word=>/^[a-z]{3,}$/.test(word)))return false;
 return short.every((word,i)=>long[i]===word)&&/^\d+(?:[/-]\d+)*$/.test(long[short.length]??"")&&/\b\d{5}\b/.test(shipment.address);
}
export function compatibleCodCandidates(shipment:MatchShipment,orders:MatchOrder[]){
 if(shipment.codSatang<=0||!shipment.recipient||!shipment.phone||!shipment.address)return [];
 return orders.filter(o=>o.affiliateId&&o.payment==="COD"&&o.recipient&&o.phone&&o.address&&o.rawText&&phonesMatch(o.phone,shipment.phone)&&quotedTotal(o.rawText)===shipment.codSatang&&comparableRecipient(o.recipient)===comparableRecipient(shipment.recipient)&&(compatibleAddress(o.address,shipment.address)||namedLocationWithExactFullName(o,shipment)));
}
