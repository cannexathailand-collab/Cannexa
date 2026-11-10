import {requireAdminPage} from '@/lib/auth';
import {documentOperators,requireOrderDocumentAccess} from '@/lib/order-document-access';
import {taxInvoiceDraft} from '@/lib/tax-invoices';
import {TaxInvoiceEditor} from '@/app/tax-invoice-editor';
export default async function TaxInvoice({params}:{params:Promise<{orderId:string}>}){
 const actor=await requireAdminPage([...documentOperators]),{orderId}=await params;
 await requireOrderDocumentAccess(actor,orderId,true);
 const draft=await taxInvoiceDraft(orderId);
 return <main className="main"><section className="card"><h1>ออกใบกำกับภาษี</h1><p>{draft.orderNumber}</p><TaxInvoiceEditor draft={draft}/></section></main>;
}
