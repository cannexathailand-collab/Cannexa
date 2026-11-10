import ExcelJS from 'exceljs';
import type {PlatformShop} from '@prisma/client';
import {shopDatabase} from './platform-shops';
import {withDatabase} from './db';
import {readStockSheet} from './stock-google';

export async function platformBusinessWorkbook(shops:PlatformShop[]){
 const workbook=new ExcelJS.Workbook();
 const sheets={
  customers:workbook.addWorksheet('ลูกค้า'),orders:workbook.addWorksheet('ออเดอร์'),stock:workbook.addWorksheet('สต๊อก'),
  sales:workbook.addWorksheet('ยอดขาย'),cod:workbook.addWorksheet('รับเงิน COD'),expenses:workbook.addWorksheet('รายจ่าย'),users:workbook.addWorksheet('ผู้ใช้'),
 };
 sheets.customers.addRow(['ร้านค้า','รหัสร้าน','รหัสลูกค้า','ชื่อ','โทรศัพท์','ที่อยู่','วันที่สร้าง']);
 sheets.orders.addRow(['ร้านค้า','รหัสร้าน','เลขออเดอร์','รหัสลูกค้า','ผู้ขาย','ชื่อผู้รับ','โทรศัพท์','ที่อยู่','การชำระเงิน','สถานะ','ข้อความออเดอร์','วันที่']);
 sheets.stock.addRow(['ร้านค้า','รหัสร้าน','รหัสสินค้า','ชื่อสินค้า','คงเหลือกรัม','ต้นทุนสตางค์ต่อกรัม']);
 sheets.sales.addRow(['ร้านค้า','รหัสร้าน','รหัสออเดอร์','เลขพัสดุ','การชำระเงิน','ยอดขายสตางค์','สถานะ','วันที่รับรู้ยอดขาย']);
 sheets.cod.addRow(['ร้านค้า','รหัสร้าน','เลขพัสดุ','ยอดรับเงินสตางค์','วันที่รายงาน']);
 sheets.expenses.addRow(['ร้านค้า','รหัสร้าน','เลขรายจ่าย','รายการ','ยอดสตางค์','สถานะ','วันที่รายการ','วันที่จ่าย']);
 sheets.users.addRow(['ร้านค้า','รหัสร้าน','ชื่อผู้ใช้','บทบาท','เปิดใช้งาน','รหัสทีม']);
 for(const shop of shops){
  const client=shopDatabase(shop.schemaName),prefix=[shop.name,shop.slug];
  const [customers,orders,stock,sales,cod,expenses,users]=await Promise.all([
   client.customer.findMany({select:{code:true,name:true,phone:true,address:true,createdAt:true},orderBy:{createdAt:'asc'}}),
   client.orderIntake.findMany({select:{orderNumber:true,customerCode:true,sellerUsername:true,recipient:true,phone:true,address:true,payment:true,status:true,rawText:true,eventAt:true},orderBy:{eventAt:'asc'}}),
   withDatabase(client,()=>readStockSheet().catch(()=>null),shop.slug),
   client.salesOrder.findMany({select:{orderId:true,tracking:true,paymentMethod:true,revenueSatang:true,status:true,recognizedAt:true},orderBy:{createdAt:'asc'}}),
   client.codReceipt.findMany({select:{tracking:true,amountSatang:true,reportAt:true},orderBy:{reportAt:'asc'}}),
   client.expense.findMany({select:{expenseNumber:true,description:true,amountSatang:true,status:true,eventAt:true,paidAt:true},orderBy:{eventAt:'asc'}}),
   client.userAccount.findMany({select:{username:true,role:true,active:true,affiliateId:true},orderBy:{username:'asc'}}),
  ]);
  for(const row of customers)sheets.customers.addRow([...prefix,row.code,row.name,row.phone,row.address,row.createdAt]);
  for(const row of orders)sheets.orders.addRow([...prefix,row.orderNumber,row.customerCode,row.sellerUsername,row.recipient,row.phone,row.address,row.payment,row.status,row.rawText,row.eventAt]);
  if(stock){for(const row of stock.products)sheets.stock.addRow([...prefix,row.code,row.name,row.remainingQuantity,row.costSatang]);}
  else{for(const row of await client.stockProduct.findMany({orderBy:{code:'asc'}}))sheets.stock.addRow([...prefix,row.code,row.name,row.remainingQuantity?.toNumber(),row.costSatang]);}
  for(const row of sales)sheets.sales.addRow([...prefix,row.orderId,row.tracking,row.paymentMethod,row.revenueSatang,row.status,row.recognizedAt]);
  for(const row of cod)sheets.cod.addRow([...prefix,row.tracking,row.amountSatang,row.reportAt]);
  for(const row of expenses)sheets.expenses.addRow([...prefix,row.expenseNumber,row.description,row.amountSatang,row.status,row.eventAt,row.paidAt]);
  for(const row of users)sheets.users.addRow([...prefix,row.username,row.role,row.active,row.affiliateId]);
 }
 for(const sheet of Object.values(sheets)){
  sheet.views=[{state:'frozen',ySplit:1}];
  sheet.getRow(1).font={bold:true};
  sheet.columns.forEach(column=>{column.width=24});
 }
 return new Uint8Array(await workbook.xlsx.writeBuffer());
}
