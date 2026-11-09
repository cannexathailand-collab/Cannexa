import {csvCell} from './policy';
import type {bookedSalesReport} from './booked-sales';

export function bookedSalesCsv(report:Awaited<ReturnType<typeof bookedSalesReport>>,demo=false){
 const amount=(value:number|null)=>value===null?'':(value/100).toFixed(2);
 const rows:unknown[][]=[
  ['ข้อมูล','วันที่รับออเดอร์ (Asia/Bangkok)','เลขออเดอร์','ผู้ขาย','รหัส Affiliate','ประเภทชำระเงิน','เลขพัสดุ','ยอดขาย (บาท)','การจัดส่ง','สถานะรับเงิน COD'],
  ...report.orderRows.map(row=>[demo?'ข้อมูลทดสอบ':'ข้อมูลจริง',row.eventAt.toLocaleString('sv-SE',{timeZone:'Asia/Bangkok'}),row.orderNumber,row.sellerUsername??'',row.affiliate?.code??'',row.paymentMethod==='COD'?'COD':'โอน',row.tracking??'',amount(row.revenueSatang),row.hasTracking?'จัดส่งแล้ว':'รอจัดส่ง',row.paymentMethod==='COD'?(row.codPaid?'รับเงินแล้ว':'รอรับเงิน'):'']),
  [],['สรุปยอดขายตามวันที่รับออเดอร์'],['รายการ','จำนวนออเดอร์','ยอดขาย (บาท)'],
  ['ทั้งหมด',report.summary.count,amount(report.summary.revenueSatang)],
  ['โอน',report.summary.transferCount,amount(report.summary.transferSatang)],
  ['COD ทั้งหมด',report.summary.codCount,amount(report.summary.codSatang)],
  ['COD รับเงินแล้ว',report.summary.paidCodCount,amount(report.summary.paidCodSatang)],
  ['COD รอรับเงิน',report.waitingCodCount,amount(report.waitingCodSatang)],
  ['ออเดอร์ที่ยังไม่ทราบยอดเงิน',report.summary.unknownAmountCount,''],
  [],['ออเดอร์เว็บใหม่รอตรวจสอบ (แสดงแยกจากยอดขายที่บันทึกแล้ว)'],['วันที่สั่ง','เลขออเดอร์เว็บ','ชื่อผู้รับ','ยอดเงิน (บาท)'],
  ...report.pendingWebsiteOrders.map(row=>[row.createdAt.toLocaleString('sv-SE',{timeZone:'Asia/Bangkok'}),row.orderNumber,row.recipient,amount(row.totalSatang)]),
  [],['ยอดขายตามแหล่งที่มาลูกค้า'],['กลุ่มลูกค้า','ช่องทาง / ผู้แนะนำ','ลูกค้าไม่ซ้ำ','ออเดอร์','ยอดขาย (บาท)'],
  ...report.sources.map(source=>[source.customerType,source.name,source.customers,source.orders,amount(source.revenueSatang)]),
 ];
 return '\uFEFF'+rows.map(row=>row.map(value=>csvCell(String(value??''))).join(',')).join('\r\n');
}
