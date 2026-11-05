export const normalizeName=(v:string)=>v.normalize("NFKC").replace(/\s/g,"").toLowerCase();
export const normalizePhone=(v:string)=>{const n=v.replace(/\D/g,"");return n.startsWith("66")?"0"+n.slice(2):n;};
export const normalizeAddress=(v:string)=>v.normalize("NFKC").replace(/ตําบล|ตำบล|อำเภอ|จังหวัด|หมู่ที่|หมู่|ต\.|อ\.|จ\./g,"").replace(/[\s,.-]/g,"").toLowerCase();
export function moneySatang(value:string|number){const v=String(value).replace(/[,฿\s]/g,"");if(!/^\d+(?:\.\d{1,2})?$/.test(v))return null;const [whole,fraction=""]=v.split(".");const n=Number(whole)*100+Number(fraction.padEnd(2,"0"));return Number.isSafeInteger(n)&&n<=2147483647?n:null;}
export function quotedTotal(text:string){const values=text.split(/\r?\n/).map(line=>line.match(/^\s*(?:ยอดตามข้อความ|ยอดรวม|รวมทั้งสิ้น|ยอดโอน|โอน|COD)\s*[:=：]\s*([\d,.]+)\s*(?:บาท|฿)?\s*$/i)).filter(Boolean);return values.length===1?moneySatang(values[0]![1]):null;}
export type MatchOrder={id:string;affiliateId:string|null;recipient:string|null;phone:string|null;address:string|null;rawText:string|null;payment:string|null};
export type MatchShipment={recipient:string;phone:string;address:string;codSatang:number};
export function shipmentCandidates(shipment:MatchShipment,orders:MatchOrder[]){
 if(shipment.codSatang<=0||!shipment.recipient||!shipment.phone||!shipment.address)return [];
 return orders.filter(o=>o.affiliateId&&o.recipient&&o.phone&&o.address&&o.rawText&&o.payment==="COD"&&normalizeName(o.recipient)===normalizeName(shipment.recipient)&&normalizePhone(o.phone)===normalizePhone(shipment.phone)&&normalizeAddress(o.address)===normalizeAddress(shipment.address)&&quotedTotal(o.rawText)===shipment.codSatang);
}
export function transferShipmentCandidates(shipment:MatchShipment,orders:MatchOrder[]){
 if(shipment.codSatang!==0||!shipment.recipient||!shipment.phone||!shipment.address)return [];
 return orders.filter(o=>o.affiliateId&&o.payment==="โอน"&&o.recipient&&o.phone&&o.address&&normalizeName(o.recipient)===normalizeName(shipment.recipient)&&normalizePhone(o.phone)===normalizePhone(shipment.phone)&&normalizeAddress(o.address)===normalizeAddress(shipment.address));
}
function comparableRecipient(value:string){
 const name=normalizeName(value);
 // A narrowly defined English nickname spelling variant, not general fuzzy names.
 return /^[a-z]{3,}$/.test(name)?name.replace(/ie$/, "y"):name;
}
export function compatibleAddress(first:string,second:string){
 const a=normalizeAddress(first),b=normalizeAddress(second);if(a===b)return !!a;
 const [short,long]=a.length<=b.length?[a,b]:[b,a];
 // Accept a substantial complete address prefix with a house/unit number.
 // Never equate house 28 with 280, or unit 28 with 28/1.
 return short.length>=20&&/\d/.test(short)&&long.startsWith(short)&&!(/[\d/]$/.test(short)&&/^[\d/]/.test(long.slice(short.length)));
}
export function compatibleCodCandidates(shipment:MatchShipment,orders:MatchOrder[]){
 if(shipment.codSatang<=0||!shipment.recipient||!shipment.phone||!shipment.address)return [];
 return orders.filter(o=>o.affiliateId&&o.payment==="COD"&&o.recipient&&o.phone&&o.address&&o.rawText&&normalizePhone(o.phone)===normalizePhone(shipment.phone)&&quotedTotal(o.rawText)===shipment.codSatang&&comparableRecipient(o.recipient)===comparableRecipient(shipment.recipient)&&compatibleAddress(o.address,shipment.address));
}
