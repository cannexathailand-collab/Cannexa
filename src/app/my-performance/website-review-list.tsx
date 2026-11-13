import {PopupDetails} from '@/app/popup-details';
import {OrderShippingDetails} from '@/app/order-shipping-details';
import {WebsiteOrderReviewControls} from '@/app/admin/orders/website/review-controls';
import type {WebsiteOrderSummary} from '@/lib/website-orders';
import type {CustomerLanguage} from '@/lib/customer-language';

export function WebsiteReviewList({orders,language,sellerCode,selfReview}:{orders:WebsiteOrderSummary[];language:CustomerLanguage;sellerCode:string;selfReview:boolean}){
 const english=language==='en';
 if(!orders.length)return null;
 return <section id="website-review" aria-label={english?'Website orders pending review':'ออเดอร์เว็บไซต์รอตรวจสอบ'}>
  <h2>{english?'Website orders pending review':'ออเดอร์จากเว็บไซต์รอตรวจสอบ'} · {orders.length}</h2>
  <p className="muted small">{english?'Pending website orders across all dates. Confirmed orders move into the regular order list.':'รายการเว็บไซต์ที่ยังไม่มีผู้รับผิดชอบ รวมทุกช่วงวันที่ เมื่อยืนยันแล้วจะเข้ารายการออเดอร์ปกติ'}</p>
  <div className="employee-order-list store-preparing-list">{orders.map(order=><article className="employee-order-card" key={order.id}>
   <header><div><strong>{order.orderNumber}</strong><small>{new Date(order.createdAt).toLocaleString(english?'en-GB':'th-TH',{timeZone:'Asia/Bangkok'})}</small></div><span className="employee-order-status">{english?'Pending review':'ต้องตรวจสอบ'}</span></header>
   <OrderShippingDetails language={language} slipUrl={order.slipVersion?'/api/customer/website-orders/'+encodeURIComponent(order.id)+'/slip?v='+order.slipVersion:null} copyDetails={{orderNumber:order.orderNumber,createdAt:new Date(order.createdAt),status:'ต้องตรวจสอบ'}} data={{recipient:order.recipient,phone:order.phone,address:order.address,payment:order.paymentMethod==='TRANSFER'?'โอน':order.paymentMethod,amountSatang:order.totalSatang,items:order.items.map(item=>({code:item.code,name:item.name,quantityMilliG:Math.round(item.grams*item.quantity*1000),description:item.pack+' × '+item.quantity}))}}>
    <PopupDetails className="compact-order-action" summary={english?'Review and confirm':'ตรวจสอบและยืนยันออเดอร์'} title={order.orderNumber}>
     <WebsiteOrderReviewControls id={order.id} status={order.status} totalSatang={order.totalSatang} sellerCode={sellerCode} selfReview={selfReview} paymentMethod={order.paymentMethod}/>
    </PopupDetails>
   </OrderShippingDetails>
  </article>)}</div>
 </section>;
}
