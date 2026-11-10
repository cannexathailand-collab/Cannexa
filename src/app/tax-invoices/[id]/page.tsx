import {notFound} from 'next/navigation';
import {currentAccount} from '@/lib/auth';
import {portalCustomer,hasPortalAccess} from '@/lib/customer-portal';
import {db} from '@/lib/db';
import {TaxInvoiceDocument} from '@/app/tax-invoice-document';
export const metadata={title:'ใบกำกับภาษี',robots:{index:false,follow:false}};
export default async function TaxInvoice({params}:{params:Promise<{id:string}>}){
 let owner=false,code:string|undefined;
 try{owner=(await currentAccount()).role==='owner';}catch(error){if(!(error instanceof Error)||error.message!=='UNAUTHORIZED')throw error;}
 if(!owner){const {key,customer}=await portalCustomer();if(!customer||!await hasPortalAccess(key,customer.code))notFound();code=customer.code;}
 const {id}=await params;
 const invoice=await db.customerTaxInvoice.findFirst({where:{id,...(!owner?{customerCode:code}:{})}});
 if(!invoice)notFound();
 return <TaxInvoiceDocument invoice={invoice} back={owner?'/admin/receipts':'/customer'}/>;
}
