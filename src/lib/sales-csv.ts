import {csvCell} from './policy';
import type {salesReport} from './sales-report';
export function salesCsv(report:Awaited<ReturnType<typeof salesReport>>,demo=false){
 const headers=['ข้อมูล','วันที่จัดส่ง (Asia/Bangkok)','เลขออเดอร์','ผู้ขาย','รหัส Affiliate','ประเภทชำระเงิน','เลขพัสดุ','ยอดขาย (บาท)','ค่าคอม (บาท)','สถานะค่าคอม','สถานะรับเงิน COD'];
 const rows=report.summary.rows.map(s=>[demo?'ข้อมูลทดสอบ':'ข้อมูลจริง',s.recognizedAt!.toLocaleString('sv-SE',{timeZone:'Asia/Bangkok'}),s.order!.orderNumber,s.order!.sellerUsername??s.affiliate?.name??'',s.affiliate?.code??'',s.paymentMethod==='COD'?'COD':'โอน',s.tracking??'',(s.revenueSatang/100).toFixed(2),s.commissionSatang===null?'รอต้นทุน':((s.status==='PAID'?(s.paidAmountSatang??s.commissionSatang):s.commissionSatang)/100).toFixed(2),s.status==='PAID'?'จ่ายแล้ว':s.status==='WAITING_COST'?'รอต้นทุน':'รอจ่าย',s.paymentMethod==='COD'?'รับเงินแล้ว':'']);
 return '\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
