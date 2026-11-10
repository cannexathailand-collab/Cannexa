import {notFound} from 'next/navigation';
import {withShopWorkspace} from '@/lib/shop-workspace';
import {shopPath} from '@/lib/shop-session';
import {ReceiptDocument} from '@/app/receipt-document';
export default async function Receipt({params}:{params:Promise<{slug:string;id:string}>}){
 const {slug,id}=await params;
 return withShopWorkspace(slug,async({client})=>{
  const receipt=await client.customerReceipt.findUnique({where:{id}});if(!receipt)notFound();
  return <ReceiptDocument receipt={receipt} back={shopPath(slug)+'/receipts'}/>;
 });
}
