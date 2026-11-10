import {withShopWorkspace} from '@/lib/shop-workspace';
import {shopPath} from '@/lib/shop-session';
import {taxInvoiceDraft} from '@/lib/tax-invoices';
import {TaxInvoiceEditor} from '@/app/tax-invoice-editor';
export default async function TaxInvoice({params}:{params:Promise<{slug:string;orderId:string}>}){
 const {slug,orderId}=await params;
 return withShopWorkspace(slug,async({readOnly})=>{
  const draft=await taxInvoiceDraft(orderId),base=shopPath(slug)+'/tax-invoices';
  return <main className="main"><section className="card"><h1>ออกใบกำกับภาษี</h1><p>{draft.orderNumber}</p>{readOnly?<p>โหมดดูข้อมูล</p>:<TaxInvoiceEditor draft={draft} endpoint={base+'/issue'} documentBase={base}/>}</section></main>;
 });
}
