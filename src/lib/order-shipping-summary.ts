import {customerLanguageTools,type CustomerLanguage} from './customer-language';
export type ShippingSummary={recipient:string|null;phone:string|null;address:string|null;payment:string|null;amountSatang:number|null;items:{code:string;name?:string|null;quantityMilliG:number;description?:string}[]};
export const shippingPaymentLabel=(payment:string|null)=>payment==='COD'?'เก็บเงินปลายทาง (COD)':payment==='โอน'?'โอนเงิน':payment==='เคลม'?'เคลม':'ยังไม่ระบุ';
export const shippingAmountLabel=(amount:number|null)=>amount===null?'ยังไม่ทราบยอด':(amount/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' บาท';
export function shippingSummaryText(data:ShippingSummary,language:CustomerLanguage='th'){
 const {t,locale}=customerLanguageTools(language);
 return [
  t('ชื่อผู้รับ')+' '+(data.recipient||t('ยังไม่ระบุ')),
  t('เบอร์โทร')+' '+(data.phone||t('ยังไม่ระบุ')),
  t('ที่อยู่')+' '+(data.address||t('ยังไม่ระบุ')),
  t('รายการสินค้า'),
  ...data.items.map(item=>item.code+(item.name?' · '+item.name:'')+' × '+(item.quantityMilliG/1000).toLocaleString(locale,{maximumFractionDigits:3})+' '+t('กรัม')+(item.description?' · '+item.description:'')),
  t('ยอดรวม')+' '+t(shippingAmountLabel(data.amountSatang)),
  t('การชำระเงิน')+' '+t(shippingPaymentLabel(data.payment)),
 ].join('\n');
}

export type OrderCopyDetails={orderNumber:string;seller?:string|null;teamName?:string|null;createdAt?:Date;status?:string;tracking?:string|null;extraLines?:string[]};
export function orderSummaryText(data:ShippingSummary,details:OrderCopyDetails,language:CustomerLanguage='th'){
 const {t,locale}=customerLanguageTools(language);
 return [
  t('เลขออเดอร์')+' '+details.orderNumber,
  ...(details.seller!==undefined?[t('ผู้ขาย')+' '+(details.seller||t('ยังไม่ระบุ'))]:[]),
  ...(details.teamName!==undefined?[t('ทีมจัดส่ง')+' '+(details.teamName||t('ยังไม่ระบุทีม'))]:[]),
  ...(details.createdAt?[t('สร้างออเดอร์')+' '+details.createdAt.toLocaleString(locale,{timeZone:'Asia/Bangkok'})]:[]),
  ...(details.status?[t('สถานะ')+' '+t(details.status)]:[]),
  shippingSummaryText(data,language),
  t('เลขพัสดุ')+' '+(details.tracking||t('ยังไม่มีเลขพัสดุ')),
  ...(details.extraLines??[]),
 ].join('\n');
}
