import ExcelJS from 'exceljs';
import {Readable} from 'node:stream';
import {contactPhones} from './contact-phones';
import {moneySatang} from './shipment-matching';

export type ManualShipmentRow={tracking:string;recipient:string;phone:string;payment?:'COD'|'โอน';amountSatang?:number};
const aliases={
 tracking:['trackingno','trackingnumber','tracking','เลขพัสดุ','หมายเลขพัสดุ','เลขที่พัสดุ','เลขติดตาม'],
 recipient:['consignee','recipient','recipientname','name','ชื่อผู้รับ','ผู้รับ','ชื่อลูกค้า','ชื่อ'],
 phone:['phonenumber','phone','telephone','tel','เบอร์โทรศัพท์','เบอร์โทร','โทรศัพท์','เบอร์ผู้รับ'],
 payment:['วิธีการชำระเงิน','วิธีชำระเงิน','payment'],
 amount:['ยอดเงินบาท','ยอดเงิน','totalamount','amount'],
};
const header=(value:string)=>value.normalize('NFKC').trim().toLowerCase().replace(/[\s._()-]/g,'');
export async function parseManualShipmentFile(bytes:Buffer,filename:string):Promise<ManualShipmentRow[]>{
 if(!bytes.length||bytes.length>2*1024*1024)throw Error('ไฟล์ต้องมีขนาดไม่เกิน 2 MB');
 const book=new ExcelJS.Workbook();
 if(/\.xlsx$/i.test(filename))await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
 else if(/\.csv$/i.test(filename))await book.csv.read(Readable.from([bytes.toString('utf8').replace(/^\uFEFF/,'')]));
 else throw Error('รองรับไฟล์ Excel .xlsx และ CSV');
 const result:ManualShipmentRow[]=[];
 for(const sheet of book.worksheets){
  if(sheet.rowCount>5010)throw Error('ไฟล์มีแถวมากเกินไป');
  let columns:Record<keyof typeof aliases,number>|null=null;
  for(let index=1;index<=sheet.rowCount;index++){
   const row=sheet.getRow(index);
   if(!columns){
    if(index>20)break;
    const map=new Map<string,number>();row.eachCell((cell,column)=>map.set(header(cell.text),column));
    const found=Object.fromEntries(Object.entries(aliases).map(([key,names])=>[key,names.map(name=>map.get(header(name))).find(Boolean)]));
    if(found.tracking&&found.recipient&&found.phone)columns=found as Record<keyof typeof aliases,number>;
    continue;
   }
   const trackingText=row.getCell(columns.tracking).text.normalize('NFKC').toUpperCase().trim();
   const tracking=trackingText.match(/^([A-Z0-9-]{8,50})(?:\s*\([A-Z0-9 _.-]+\))?$/)?.[1]??trackingText;
   const recipient=row.getCell(columns.recipient).text.trim();
   let phone=row.getCell(columns.phone).text.trim();
   if(!tracking&&!recipient&&!phone)continue;
   if(/^\d{9}$/.test(phone)&&!phone.startsWith('0'))phone='0'+phone;
   const phones=contactPhones(phone);
   if(!/^[A-Z0-9-]{8,50}$/.test(tracking)||!recipient||recipient.length>200||!phones.length||!phones.every(number=>/^0\d{8,9}$/.test(number)))throw Error('ข้อมูลชื่อ เบอร์ หรือเลขพัสดุไม่ครบในแถว '+index);
   const paymentText=columns.payment?row.getCell(columns.payment).text.trim().toUpperCase():'';
   const payment=paymentText==='COD'?'COD':['BANK','TRANSFER','โอน','โอนเงิน'].includes(paymentText)?'โอน':undefined;
   const amount=columns.amount?moneySatang(row.getCell(columns.amount).text):null;
   if(paymentText&&!payment||columns.amount&&amount===null)throw Error('อ่านวิธีชำระเงินหรือยอดเงินไม่ได้ในแถว '+index);
   result.push({tracking,recipient,phone:phones.join(' / '),...(payment?{payment}:{}),...(amount!==null?{amountSatang:amount}:{})});
   if(result.length>500)throw Error('อัปโหลดได้ครั้งละไม่เกิน 500 รายการ');
  }
 }
 if(!result.length)throw Error('ไม่พบคอลัมน์ชื่อผู้รับ เบอร์โทร และเลขพัสดุ');
 if(new Set(result.map(row=>row.tracking)).size!==result.length)throw Error('พบเลขพัสดุซ้ำในไฟล์');
 return result;
}
