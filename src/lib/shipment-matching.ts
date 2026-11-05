export const normalizeName=(v:string)=>v.normalize("NFKC").replace(/\s/g,"").toLowerCase();
export const normalizePhone=(v:string)=>{const n=v.replace(/\D/g,"");return n.startsWith("66")?"0"+n.slice(2):n;};
export const normalizeAddress=(v:string)=>v.normalize("NFKC").replace(/ตําบล|ตำบล|อำเภอ|จังหวัด|หมู่ที่|หมู่|ต\.|อ\.|จ\./g,"").replace(/[\s,.-]/g,"").toLowerCase();
export function moneySatang(value:string|number){const v=String(value).replace(/[,฿\s]/g,"");if(!/^\d+(?:\.\d{1,2})?$/.test(v))return null;const [whole,fraction=""]=v.split(".");const n=Number(whole)*100+Number(fraction.padEnd(2,"0"));return Number.isSafeInteger(n)&&n<=2147483647?n:null;}
export function quotedTotal(text:string){const values=text.split(/\r?\n/).map(line=>line.match(/^\s*(?:ยอดตามข้อความ|ยอดรวม|รวมทั้งสิ้น|COD)\s*[:=：]\s*([\d,.]+)\s*(?:บาท|฿)?\s*$/i)).filter(Boolean);return values.length===1?moneySatang(values[0]![1]):null;}
export type MatchOrder={id:string;affiliateId:string|null;recipient:string|null;phone:string|null;address:string|null;rawText:string|null;payment:string|null};
export type MatchShipment={recipient:string;phone:string;address:string;codSatang:number};
export function shipmentCandidates(shipment:MatchShipment,orders:MatchOrder[]){
 if(shipment.codSatang<=0||!shipment.recipient||!shipment.phone||!shipment.address)return [];
 return orders.filter(o=>o.affiliateId&&o.recipient&&o.phone&&o.address&&o.rawText&&o.payment==="COD"&&normalizeName(o.recipient)===normalizeName(shipment.recipient)&&normalizePhone(o.phone)===normalizePhone(shipment.phone)&&normalizeAddress(o.address)===normalizeAddress(shipment.address)&&quotedTotal(o.rawText)===shipment.codSatang);
}
