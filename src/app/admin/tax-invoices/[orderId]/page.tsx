import {requireAdminPage} from '@/lib/auth';
import {taxInvoiceDraft} from '@/lib/tax-invoices';
import {TaxInvoiceEditor} from '@/app/tax-invoice-editor';
export default async function TaxInvoice({params}:{params:Promise<{orderId:string}>}){
 await requireAdminPage();const {orderId}=await params;
 const draft=await taxInvoiceDraft(orderId);
 return <section className="card"><h1>ออกใบกำกับภาษี</h1><p>{draft.orderNumber}</p><TaxInvoiceEditor draft={draft}/></section>;
}
