import {stockCode} from './stock-code';
export type OrderStockItem={code:string;quantityMilliG:number};
export function orderStockItems(rawText:string|null):{items:OrderStockItem[];issues:string[]}{
 const lines=(rawText??'').normalize('NFKC').split(/\r?\n/).map(s=>s.trim()).filter(Boolean),heading=lines.findIndex(s=>/^(?:รายการสินค้า|สินค้า)\s*[:：]?\s*$/.test(s));
 let candidates:string[]=[];
 if(heading>=0){for(const line of lines.slice(heading+1)){if(/^(?:ยอดสินค้า|ค่าส่ง|ยอดรวม|รวมทั้งสิ้น|ชำระเงิน|วิธีชำระเงิน)\s*[:：=]/.test(line))break;candidates.push(line);}}
 else candidates=lines.filter(s=>/^สินค้า\s+/.test(s));
 const quantities=new Map<string,number>(),issues:string[]=[];
 for(const [index,original]of candidates.entries()){const line=original.replace(/^(?:[-•]|\d+[.)])\s+/,'').replace(/^สินค้า\s+/,'');const match=line.match(/^([\p{L}\p{M}\p{N}._-]+?)\s*[x×*]\s*((?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,3})?)\s*(KG|กิโลกรัม|G|กรัม)?(?:\s*(?:=|ราคา|@)\s*.*)?$/iu);if(!match){issues.push('อ่านรหัสหรือจำนวนในรายการสินค้าบรรทัดที่ '+(index+1)+' ไม่ได้');continue;}const parsed=stockCode.safeParse(match[1]);const quantity=Number(match[2].replace(/,/g,'')),kg=match[3]?.toUpperCase()==='KG'||match[3]==='กิโลกรัม';const milli=Math.round(quantity*(kg?1000000:1000));if(!parsed.success||quantity<=0||!Number.isSafeInteger(milli)||milli>999999999000){issues.push('รหัสหรือจำนวนสินค้าไม่ถูกต้องในบรรทัดที่ '+(index+1));continue;}const total=(quantities.get(parsed.data)??0)+milli;if(!Number.isSafeInteger(total)||total>999999999000){issues.push('จำนวนสินค้ารวมมากเกินไป');continue;}quantities.set(parsed.data,total);}
 if(!candidates.length)issues.push('ไม่พบรายการสินค้าพร้อมรหัสและจำนวน G');if(candidates.length>50)issues.push('รายการสินค้าเกิน 50 บรรทัด');
 return {items:issues.length?[]:[...quantities].map(([code,quantityMilliG])=>({code,quantityMilliG})),issues};
}
