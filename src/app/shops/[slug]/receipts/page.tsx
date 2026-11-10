import {withShopWorkspace} from '@/lib/shop-workspace';
import {shopPath} from '@/lib/shop-session';
import {ReceiptAdmin} from '@/app/receipt-admin';
import {ShopWorkspaceNav} from '../workspace-nav';
export default async function Receipts({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{q?:string}>}){
 const {slug}=await params,{q}=await searchParams,base=shopPath(slug)+'/receipts';
 const content=await withShopWorkspace(slug,async({readOnly})=>ReceiptAdmin({query:q?.slice(0,100),base,issueEndpoint:base+'/issue',receiptBase:base,settingsEndpoint:base+'/settings',readOnly}));
 return <main className="main"><ShopWorkspaceNav slug={slug}/>{content}</main>;
}
