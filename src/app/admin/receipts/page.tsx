import {requireAdminPage} from '@/lib/auth';
import {ReceiptAdmin} from '@/app/receipt-admin';
export default async function Receipts({searchParams}:{searchParams:Promise<{q?:string}>}){
 await requireAdminPage();const {q}=await searchParams;
 return <ReceiptAdmin query={q?.slice(0,100)}/>;
}
