import {documentReaders,requireOrderDocumentAccess,type DocumentAccount} from '@/lib/order-document-access';
import {notFound} from 'next/navigation';
import {currentAccount} from '@/lib/auth';
import {portalCustomer,hasPortalAccess} from '@/lib/customer-portal';
import {customerLanguage} from '@/lib/customer-language-server';
import {db} from '@/lib/db';
import {ReceiptDocument} from '@/app/receipt-document';

export const dynamic='force-dynamic';
export const metadata={title:'ใบเสร็จรับเงิน / Receipt',robots:{index:false,follow:false}};
export default async function ReceiptPage({params}:{params:Promise<{id:string}>}){
 let owner=false,code:string|undefined,operator:DocumentAccount|undefined;
 try{const actor=await currentAccount();owner=documentReaders.some(role=>role===actor.role);if(owner)operator=actor;}catch(error){if(!(error instanceof Error)||error.message!=='UNAUTHORIZED')throw error;}
 if(!owner){const {key,customer}=await portalCustomer();if(!customer||!await hasPortalAccess(key,customer.code))notFound();code=customer.code;}
 const {id}=await params;
 const receipt=await db.customerReceipt.findFirst({where:{id,...(!owner?{customerCode:code}: {})}});
 if(!receipt)notFound();
 if(operator)try{await requireOrderDocumentAccess(operator,receipt.orderId);}catch{notFound();}
 const {language}=await customerLanguage();
 return <ReceiptDocument receipt={receipt} english={language==='en'} back={owner?(operator?.role==='owner'?'/admin/receipts':operator?.role==='store'?'/admin/store-orders':['employee','sales'].includes(operator?.role??'')?'/my-performance/orders':'/admin'):'/customer'}/>;
}
