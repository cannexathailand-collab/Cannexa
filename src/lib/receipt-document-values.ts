import {z} from 'zod';

const websiteReceiptLine=z.object({
 code:z.string(),name:z.string().nullable().optional(),pack:z.string(),
 quantity:z.number().int().positive(),unitPriceSatang:z.number().int().nonnegative(),
 lineTotalSatang:z.number().int().nonnegative(),
});

export function pricedReceiptItems(value:unknown,shippingSatang:number,totalSatang:number){
 const parsed=websiteReceiptLine.array().min(1).safeParse(value);
 if(!parsed.success||!Number.isSafeInteger(shippingSatang)||shippingSatang<0)return null;
 if(parsed.data.some(line=>line.quantity*line.unitPriceSatang!==line.lineTotalSatang))return null;
 if(parsed.data.reduce((sum,line)=>sum+line.lineTotalSatang,shippingSatang)!==totalSatang)return null;
 const items=parsed.data.map(line=>({
  description:[line.code,line.name,line.pack].filter(Boolean).join(' · '),
  quantity:String(line.quantity),unitPriceSatang:line.unitPriceSatang,totalSatang:line.lineTotalSatang,
 }));
 if(shippingSatang)items.push({description:'ค่าจัดส่ง',quantity:'1',unitPriceSatang:shippingSatang,totalSatang:shippingSatang});
 return items;
}

const thaiDigits=['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
const thaiPlaces=['','สิบ','ร้อย','พัน','หมื่น','แสน'];

function thaiInteger(value:number,afterMillion=false):string{
 if(value>=1000000){
  const remainder=value%1000000;
  return thaiInteger(Math.floor(value/1000000))+'ล้าน'+(remainder?thaiInteger(remainder,true):'');
 }
 if(value===0)return 'ศูนย์';
 return String(value).split('').map((digit,index,digits)=>{
  const number=Number(digit),place=digits.length-index-1;
  if(number===0)return '';
  if(place===1)return (number===1?'':number===2?'ยี่':thaiDigits[number])+'สิบ';
  if(place===0&&number===1&&(value>1||afterMillion))return 'เอ็ด';
  return thaiDigits[number]+thaiPlaces[place];
 }).join('');
}

export function thaiBahtText(satang:number){
 if(!Number.isSafeInteger(satang)||satang<0)throw Error('INVALID_RECEIPT_AMOUNT');
 const fraction=satang%100;
 return thaiInteger(Math.floor(satang/100))+'บาท'+(fraction?thaiInteger(fraction)+'สตางค์':'ถ้วน');
}
