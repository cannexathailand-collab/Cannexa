import type {ReactNode} from 'react';
import {CopyOrderShipping} from './copy-order-shipping';
import {orderSummaryText,type OrderCopyDetails,shippingSummaryText,shippingPaymentLabel,shippingAmountLabel,type ShippingSummary} from '@/lib/order-shipping-summary';
import {customerLanguageTools,type CustomerLanguage} from '@/lib/customer-language';

export function OrderShippingDetails({data,tracking,children,documentActions,copyDetails,teamName,sellerName,language='th'}:{data:ShippingSummary;tracking?:string|null;children?:ReactNode;documentActions?:ReactNode;copyDetails?:Omit<OrderCopyDetails,'tracking'>;teamName?:string|null;sellerName?:string|null;language?:CustomerLanguage}){
 const {t,locale}=customerLanguageTools(language);
 const seller=sellerName!==undefined?sellerName:copyDetails?.seller;
 return <div className="order-shipping-details">
  {seller!==undefined&&<p className="order-shipping-seller">{t('ผู้ขาย')} <strong>{seller||t('ยังไม่ระบุ')}</strong></p>}
  <p className="order-shipping-team">{t('ทีมจัดส่ง')} <strong>{teamName||t('ยังไม่ระบุทีม')}</strong></p>
  <dl className="shipping-contact-facts">
   <div><dt>{t('ชื่อผู้รับ')}</dt><dd>{data.recipient||t('ยังไม่ระบุ')}</dd></div>
   <div><dt>{t('เบอร์โทร')}</dt><dd>{data.phone||t('ยังไม่ระบุ')}</dd></div>
   <div className="shipping-address"><dt>{t('ที่อยู่จัดส่ง')}</dt><dd>{data.address||t('ยังไม่ระบุ')}</dd></div>
  </dl>
  <h3>{t('สินค้าที่ต้องจัด')}</h3>
  {data.items.length?<ul>{data.items.map((item,index)=><li key={item.code+'-'+index}><strong>{item.code}</strong>{item.name?' · '+item.name:''} · {(item.quantityMilliG/1000).toLocaleString(locale,{maximumFractionDigits:3})} G{item.description?' · '+item.description:''}</li>)}</ul>:<p className="muted">{t('ยังไม่มีรายการสินค้าที่อ่านได้ครบ กรุณาตรวจข้อความออเดอร์')}</p>}
  <dl className="shipping-payment-facts">
   <div><dt>{t('การชำระเงิน')}</dt><dd>{t(shippingPaymentLabel(data.payment))}</dd></div>
   <div><dt>{t('ยอดรวม')}</dt><dd>{t(shippingAmountLabel(data.amountSatang))}</dd></div>
   <div><dt>{t('เลขพัสดุ')}</dt><dd>{tracking||t('ยังไม่มีเลขพัสดุ')}</dd></div>
  </dl>
  <div className="shipping-actions"><CopyOrderShipping language={language} text={copyDetails?orderSummaryText(data,{...copyDetails,seller,tracking,teamName:teamName||t('ยังไม่ระบุทีม')},language):shippingSummaryText(data,language)} label={copyDetails?'คัดลอกรายละเอียดออเดอร์':undefined}/>{children}{documentActions}</div>
 </div>;
}
