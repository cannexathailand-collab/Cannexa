export function parseExpenseText(text:string){
 const lines=text.replace(/\r/g,'').split('\n').map(l=>l.trim()).filter(Boolean);if(!/^(รายจ่าย|ค่าใช้จ่าย)\s*[:：]?$/.test(lines[0]??''))return null;
 const issues:string[]=[];const item=lines[1]?.match(/^(.+?)\s+((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)\s*(?:บาท)?$/);
 const description=item?.[1].trim()??null;let amountSatang:number|null=null;
 if(item){const [whole,fraction='']=item[2].replaceAll(',','').split('.');const value=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));if(value>0n&&value<=2147483647n)amountSatang=Number(value);}
 if(!description||description.length>300)issues.push('ระบุรายการและยอดเงินในบรรทัดที่สอง');if(amountSatang===null)issues.push('ยอดเงินต้องมากกว่าศูนย์และมีทศนิยมไม่เกินสองตำแหน่ง');
 const bank=lines[2]?.match(/^(.+?)\s+([\d -]{6,30})$/);const bankName=bank?.[1].trim()??null,bankAccount=bank?.[2].replace(/[ -]/g,'')??null;
 if(!bankName||!bankAccount||!/^\d{6,20}$/.test(bankAccount))issues.push('ระบุธนาคารและเลขบัญชีในบรรทัดที่สาม');
 const recipient=lines[3]??null;if(!recipient||recipient.length>150)issues.push('ระบุชื่อผู้รับในบรรทัดที่สี่');if(lines.length!==4)issues.push('ใช้ข้อความสี่บรรทัดตามรูปแบบรายจ่าย');
 return {description,amountSatang,bankName,bankAccount,recipient,issues};
}
