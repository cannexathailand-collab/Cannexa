import {test} from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseManualShipmentFile} from '../src/lib/manual-shipment-file';
import {parseOrderAddress} from '../src/lib/order-parser';

test('reads the original export columns and strips only the carrier suffix',async()=>{
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Employee Data');
 sheet.addRow(['No.','Order No.','ช่องทาง/เพจ','วันที่สั่งซื้อ','ชื่อลูกค้า','เบอร์โทร','ที่อยู่','หมายเหตุ','รหัสสินค้า','สินค้า','จำนวนชิ้น','น้ำหนัก (กก.)','TRACKING NO.']);
 sheet.addRow([1,'external123','LINE','09/11/2026','Example','081-234-5678','12 Test','','A1','Product',1,1,'WA258770816TH (THAI_POST)']);
 assert.deepEqual(await parseManualShipmentFile(Buffer.from(await book.xlsx.writeBuffer()),'export.xlsx'),[{tracking:'WA258770816TH',recipient:'Example',phone:'0812345678',address:'12 Test'}]);
});
test('CSV supports quoted names, UTF8 BOM and a phone stored without its leading zero',async()=>{
 const rows=await parseManualShipmentFile(Buffer.from('\uFEFFชื่อลูกค้า,เบอร์โทร,TRACKING NO.\r\n"Example, Customer",812345678,WA258770816TH (THAI_POST)'),'export.csv');
 assert.equal(rows[0].recipient,'Example, Customer');assert.equal(rows[0].phone,'0812345678');
 await assert.rejects(parseManualShipmentFile(Buffer.from('ชื่อลูกค้า,เบอร์โทร,TRACKING NO.\nA,0812345678,WA258770816TH\nB,0812345678,WA258770816TH'),'export.csv'),/ซ้ำ/);
});
test('address block keeps continuation lines and stops before product or payment headings',()=>{
 assert.equal(parseOrderAddress('ที่อยู่: ร้านทดสอบ\n12 ถนนทดสอบ\nกรุงเทพ 10200\nรายการสินค้า\nA1 x 10 G\nยอดรวม: 100'),'ร้านทดสอบ 12 ถนนทดสอบ กรุงเทพ 10200');
 assert.equal(parseOrderAddress('ที่อยู่:\n12 กรุงเทพ 10200\nชำระเงิน: COD'),'12 กรุงเทพ 10200');
});
test('reads payment and declared amount from the export without changing them',async()=>{
 const rows=await parseManualShipmentFile(Buffer.from('ชื่อลูกค้า,เบอร์โทร,TRACKING NO.,วิธีการชำระเงิน,ยอดเงิน(บาท)\nExample,0812345678,WA258770816TH (THAI_POST),BANK,"1,025"'),'export.csv');
 assert.equal(rows[0].payment,'โอน');assert.equal(rows[0].amountSatang,102500);
});
