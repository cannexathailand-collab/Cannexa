import {ReceiptButton} from './receipt-button';

export function OrderDocumentButtons({orderId,shopBase}:{orderId:string;shopBase?:string}){
 return <div className="order-document-buttons" aria-label="เอกสารออเดอร์">
   <ReceiptButton orderId={orderId} endpoint={shopBase?shopBase+'/receipts/issue':undefined} receiptBase={shopBase?shopBase+'/receipts':undefined}/>
   <a className="button secondary" href={shopBase?shopBase+'/tax-invoices/new/'+encodeURIComponent(orderId):'/tax-invoices/new/'+encodeURIComponent(orderId)}>ใบกำกับภาษี</a>
 </div>;
}
