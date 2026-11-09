import type {ReactNode} from 'react';
import {CopyOrderShipping} from './copy-order-shipping';
import {shippingSummaryText,shippingPaymentLabel,shippingAmountLabel,type ShippingSummary} from '@/lib/order-shipping-summary';

export function OrderShippingDetails({data,tracking,children}:{data:ShippingSummary;tracking?:string|null;children?:ReactNode}){
 return <div className="order-shipping-details">
  <dl className="shipping-contact-facts">
   <div><dt>ชื่อผู้รับ</dt><dd>{data.recipient||'ยังไม่ระบุ'}</dd></div>
   <div><dt>เบอร์โทร</dt><dd>{data.phone||'ยังไม่ระบุ'}</dd></div>
   <div className="shipping-address"><dt>ที่อยู่จัดส่ง</dt><dd>{data.address||'ยังไม่ระบุ'}</dd></div>
  </dl>
  <h3>สินค้าที่ต้องจัด</h3>
  {data.items.length?<ul>{data.items.map((item,index)=><li key={item.code+'-'+index}><strong>{item.code}</strong>{item.name?' · '+item.name:''} · {(item.quantityMilliG/1000).toLocaleString('th-TH',{maximumFractionDigits:3})} G{item.description?' · '+item.description:''}</li>)}</ul>:<p className="muted">ยังไม่มีรายการสินค้าที่อ่านได้ครบ กรุณาตรวจข้อความออเดอร์</p>}
  <dl className="shipping-payment-facts">
   <div><dt>การชำระเงิน</dt><dd>{shippingPaymentLabel(data.payment)}</dd></div>
   <div><dt>ยอดรวม</dt><dd>{shippingAmountLabel(data.amountSatang)}</dd></div>
   <div><dt>เลขพัสดุ</dt><dd>{tracking||'ยังไม่มีเลขพัสดุ'}</dd></div>
  </dl>
  <div className="shipping-actions"><CopyOrderShipping text={shippingSummaryText(data)}/>{children}</div>
 </div>;
}
