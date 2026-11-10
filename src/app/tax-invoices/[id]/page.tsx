import {documentReaders,requireOrderDocumentAccess,type DocumentAccount} from '@/lib/order-document-access';
import {notFound} from 'next/navigation';
import {currentAccount} from '@/lib/auth';
import {portalCustomer,hasPortalAccess} from '@/lib/customer-portal';
import {db} from '@/lib/db';
import {TaxInvoiceDocument} from '@/app/tax-invoice-document';
export const metadata={title:'ใบกำกับภาษี',robots:{index:false,follow:false}};
export default async function TaxInvoice({params}:{params:Promise<{id:string}>}){
 let owner=false,code:string|undefined,operator:DocumentAccount|undefined;
 try{const actor=await currentAccount();owner=documentReaders.some(role=>role===actor.role);if(owner)operator=actor;}catch(error){if(!(error instanceof Error)||error.message!=='UNAUTHORIZED')throw error;}
 if(!owner){const {key,customer}=await portalCustomer();if(!customer||!await hasPortalAccess(key,customer.code))notFound();code=customer.code;}
 const {id}=await params;
 const invoice=await db.customerTaxInvoice.findFirst({where:{id,...(!owner?{customerCode:code}:{})}});
 if(!invoice)notFound();
 if(operator)try{await requireOrderDocumentAccess(operator,invoice.orderId);}catch{notFound();}
 return <TaxInvoiceDocument invoice={invoice} back={owner?(operator?.role==='owner'?'/admin/receipts':operator?.role==='store'?'/admin/store-orders':['employee','sales'].includes(operator?.role??'')?'/my-performance/orders':'/admin'):'/customer'}/>;
}
