import {documentReaders,requireOrderDocumentAccess} from '@/lib/order-document-access';
import {notFound} from 'next/navigation';
import {withShopWorkspace} from '@/lib/shop-workspace';
import {shopPath} from '@/lib/shop-session';
import {TaxInvoiceDocument} from '@/app/tax-invoice-document';
export default async function TaxInvoice({params}:{params:Promise<{slug:string;id:string}>}){
 const {slug,id}=await params;
 return withShopWorkspace(slug,async({client,account})=>{
  const invoice=await client.customerTaxInvoice.findUnique({where:{id}});if(!invoice)notFound();await requireOrderDocumentAccess(account,invoice.orderId);
  return <TaxInvoiceDocument invoice={invoice} back={shopPath(slug)+(account.role==='owner'?'/receipts':'/orders')}/>;
 },documentReaders);
}
