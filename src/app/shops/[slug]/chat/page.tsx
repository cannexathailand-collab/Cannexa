import {withShopWorkspace} from '@/lib/shop-workspace';
import {shopPath} from '@/lib/shop-session';
import {ShopWorkspaceNav} from '../workspace-nav';
import {AdminChat} from '@/app/admin-chat';
export default async function ShopChat({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const {shop,account,ready,readOnly}=await withShopWorkspace(slug,async({shop,account,client,readOnly})=>({shop,account,readOnly,ready:!!await client.openAiConnection.findUnique({where:{id:'active'},select:{id:true}})}),['owner','admin']);
 return <main className="main"><h1>Chat AI · {shop.name}</h1><ShopWorkspaceNav slug={slug} role={account.role}/><div className="admin-content"><AdminChat key={slug} ready={ready&&!readOnly} endpoint={shopPath(slug)+'/chat/ask'}/></div></main>;
}
