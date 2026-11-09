import {csvCell} from './policy';
import type {salesReport} from './sales-report';
export function salesCsv(report:Awaited<ReturnType<typeof salesReport>>,demo=false){
 const headers=['ข้อมูล','วันที่จัดส่ง (Asia/Bangkok)','เลขออเดอร์','ผู้ขาย','รหัส Affiliate','ประเภทชำระเงิน','เลขพัสดุ','ยอดขาย (บาท)','ค่าคอม (บาท)','สถานะค่าคอม','สถานะรับเงิน COD'];
 const rows=report.summary.rows.map(s=>[demo?'ข้อมูลทดสอบ':'ข้อมูลจริง',s.recognizedAt!.toLocaleString('sv-SE',{timeZone:'Asia/Bangkok'}),s.order!.orderNumber,s.order!.sellerUsername??s.affiliate?.name??'',s.affiliate?.code??'',s.paymentMethod==='COD'?'COD':'โอน',s.tracking??'',(s.revenueSatang/100).toFixed(2),s.commissionSatang===null?'รอต้นทุน':((s.status==='PAID'?(s.paidAmountSatang??s.commissionSatang):s.commissionSatang)/100).toFixed(2),s.status==='PAID'?'จ่ายแล้ว':s.status==='WAITING_COST'?'รอต้นทุน':'รอจ่าย',s.paymentMethod==='COD'?'รับเงินแล้ว':'']);
 return '\uFEFF'+[headers,...rows,[],['ยอดขายตามแหล่งที่มา'],['ช่องทาง / ผู้แนะนำ','ลูกค้าที่ซื้อไม่ซ้ำ','ออเดอร์','ยอดขาย (บาท)'],...report.sources.map(s=>[s.name,String(s.customers),String(s.orders),(s.revenueSatang/100).toFixed(2)]),[],
 ['สรุปออเดอร์ที่จัดส่งรวม COD รอรับเงิน'],['รายการ','จำนวนออเดอร์','ยอดตามออเดอร์ (บาท)'],
 ['ทั้งหมด',String(report.orderTotals.count),(report.orderTotals.amountSatang/100).toFixed(2)],
 ['โอน',String(report.orderTotals.transferCount),(report.summary.transferSatang/100).toFixed(2)],
 ['COD ทั้งหมด',String(report.orderTotals.codCount),(report.orderTotals.codSatang/100).toFixed(2)],
 ['COD รับเงินแล้ว',String(report.orderTotals.paidCodCount),(report.summary.codSatang/100).toFixed(2)],
 ['COD รอรับเงิน',String(report.waitingCodCount),(report.waitingCodSatang/100).toFixed(2)],[],
 ['รายการออเดอร์ที่จัดส่งทั้งหมด'],['เลขออเดอร์','วันที่จัดส่ง (Asia/Bangkok)','ประเภท','ยอดตามออเดอร์ (บาท)','สถานะรับเงิน'],
 ...report.orderRows.map(s=>[s.order!.orderNumber,s.shipment!.dispatchedAt!.toLocaleString('sv-SE',{timeZone:'Asia/Bangkok'}),s.paymentMethod==='COD'?'COD':'โอน',(s.revenueSatang/100).toFixed(2),s.paymentMethod==='COD'?(s.receipt?.amountSatang===s.revenueSatang?'รับเงินแล้ว':'รอรับเงิน'):'โอน'])].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
