export type ShippingSummary={recipient:string|null;phone:string|null;address:string|null;payment:string|null;amountSatang:number|null;items:{code:string;name?:string|null;quantityMilliG:number;description?:string}[]};
export const shippingPaymentLabel=(payment:string|null)=>payment==='COD'?'เก็บเงินปลายทาง (COD)':payment==='โอน'?'โอนเงิน':payment==='เคลม'?'เคลม':'ยังไม่ระบุ';
export const shippingAmountLabel=(amount:number|null)=>amount===null?'ยังไม่ทราบยอด':(amount/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' บาท';
export function shippingSummaryText(data:ShippingSummary){
 return [
  'ชื่อผู้รับ '+(data.recipient||'ยังไม่ระบุ'),
  'เบอร์โทร '+(data.phone||'ยังไม่ระบุ'),
  'ที่อยู่ '+(data.address||'ยังไม่ระบุ'),
  'รายการสินค้า',
  ...data.items.map(item=>item.code+(item.name?' · '+item.name:'')+' × '+(item.quantityMilliG/1000).toLocaleString('th-TH',{maximumFractionDigits:3})+' กรัม'+(item.description?' · '+item.description:'')),
  'ยอดรวม '+shippingAmountLabel(data.amountSatang),
  'การชำระเงิน '+shippingPaymentLabel(data.payment),
 ].join('\n');
}

export type OrderCopyDetails={orderNumber:string;seller?:string|null;teamName?:string|null;createdAt?:Date;status?:string;tracking?:string|null;extraLines?:string[]};
export function orderSummaryText(data:ShippingSummary,details:OrderCopyDetails){
 return [
  'เลขออเดอร์ '+details.orderNumber,
  ...(details.seller!==undefined?['ผู้ขาย '+(details.seller||'ยังไม่ระบุ')]:[]),
  ...(details.teamName!==undefined?['ทีมจัดส่ง '+(details.teamName||'ยังไม่ระบุทีม')]:[]),
  ...(details.createdAt?['สร้างออเดอร์ '+details.createdAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})]:[]),
  ...(details.status?['สถานะ '+details.status]:[]),
  shippingSummaryText(data),
  'เลขพัสดุ '+(details.tracking||'ยังไม่มีเลขพัสดุ'),
  ...(details.extraLines??[]),
 ].join('\n');
}
