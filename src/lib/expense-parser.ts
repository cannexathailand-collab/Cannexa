import {moneySatang} from './shipment-matching';import type {ExpenseLine} from './expense-items';
const money='(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?';
const totalPattern=new RegExp('^(?:ยอดรวม|รวม(?:ทั้งสิ้น|ทั้งหมด|ค่าใช้จ่าย|เป็นเงิน)?|ยอดรายจ่าย|ยอดจ่าย)\\s*[:=：]?\\s*(?:฿\\s*)?('+money+')\\s*(?:บาท)?$','i');
const itemPattern=new RegExp('^(.+?)\\s+(?:฿\\s*)?('+money+')\\s*(?:บาท)?$');const amountPattern=new RegExp('^(?:฿\\s*)?('+money+')\\s*(?:บาท)?$');
const isBankName=(name:string)=>/^(?:ธนาคาร.*|กสิกร(?:ไทย)?|กรุงไทย|กรุงเทพ|ไทยพาณิชย์|กรุงศรี(?:อยุธยา)?|ทหารไทยธนชาต|ทีทีบี|ออมสิน|ธกส\.?|ธอส\.?|พร้อมเพย์|KBank|SCB|KTB|BBL|TTB|TMB|UOB|CIMB|GSB|Bank)$/i.test(name.trim());
export function parseExpenseText(text:string){
 const lines=text.replace(/\r/g,'').split('\n').map(l=>l.trim()).filter(Boolean);if(!/^(รายจ่าย|ค่าใช้จ่าย)\s*[:：]?$/.test(lines[0]??''))return null;
 const issues:string[]=[],items:ExpenseLine[]=[],totals:number[]=[],pending:string[]=[];let bankName:string|null=null,bankAccount:string|null=null,recipient:string|null=null;const metadata=new Set<number>();
 for(let i=1;i<lines.length;i++){const bank=lines[i].match(/^(.+?)\s+([\d -]+)$/);if(bank&&isBankName(bank[1])){if(bankName)issues.push('พบข้อมูลบัญชีหลายบัญชี กรุณาแยกข้อความ');bankName=bank[1];bankAccount=bank[2].replace(/[ -]/g,'');metadata.add(i);if(!/^\d{6,20}$/.test(bankAccount))issues.push('เลขบัญชีที่ระบุไม่ถูกต้อง');const following=lines[i+1];if(following&&!itemPattern.test(following)&&!totalPattern.test(following)&&!amountPattern.test(following)){recipient=following;metadata.add(i+1);}}}
 const add=(description:string,amount:string)=>{const value=moneySatang(amount);if(!description.trim()||value===null||value<=0){issues.push('ชื่อรายการและจำนวนเงินต้องถูกต้องและมากกว่าศูนย์');return;}items.push({description:description.trim().replace(/[:=：]\s*$/,'').trim(),amountSatang:value});};
 for(let i=1;i<lines.length;i++){if(metadata.has(i))continue;const line=lines[i],total=line.match(totalPattern);if(total){const amount=moneySatang(total[1]);if(amount!==null)totals.push(amount);continue;}
  if(/^(?:หมายเหตุ|วันที่|ผู้จ่าย|ผู้โอน)\s*[:：]/.test(line))continue;
  const item=line.match(itemPattern);if(item){add([...pending.splice(0),item[1]].join('\n'),item[2]);continue;}
  const amount=line.match(amountPattern);if(amount&&pending.length){add(pending.splice(0).join('\n'),amount[1]);continue;}pending.push(line);
 }
 if(new Set(totals).size>1)issues.push('พบยอดรวมหลายค่าที่ไม่ตรงกัน');
 if(!items.length&&pending.length&&totals.length===1)add(pending.splice(0).join('\n'),String(totals[0]/100));
 if(pending.length){if(totals.length&&items.length)items[items.length-1].description+='\n'+pending.join('\n');else issues.push('มีรายละเอียดรายการที่ยังไม่พบยอดเงิน');}
 if(!items.length)issues.push('ยังไม่พบชื่อรายการพร้อมยอดเงิน');const sum=items.reduce((n,item)=>n+item.amountSatang,0);if(totals.length&&totals.some(total=>total!==sum))issues.push('ยอดรวมที่แจ้งไม่ตรงกับผลรวมรายการ');if(!Number.isSafeInteger(sum)||sum<=0||sum>2147483647)issues.push('ยอดรวมต้องมากกว่าศูนย์และอยู่ในวงเงินที่บันทึกได้');
 return {description:items.length===1?items[0].description:items.length?'รายจ่าย '+items.length+' รายการ':null,amountSatang:sum>0&&sum<=2147483647?sum:null,bankName,bankAccount,recipient,items,issues};
}
