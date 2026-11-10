import {notFound} from 'next/navigation';
import {activeShop} from '@/lib/shop-session';
import {shopDatabase} from '@/lib/platform-shops';
import {withDatabase} from '@/lib/db';
import {documentBrandingSnapshot} from '@/lib/document-branding';
import {StoreBrandProvider} from '@/app/store-brand';
export default async function ShopLayout({params,children}:{params:Promise<{slug:string}>;children:React.ReactNode}){
 const {slug}=await params;
 const shop=await activeShop(slug);
 if(!shop)notFound();
 const brand=await withDatabase(shopDatabase(shop.schemaName),()=>documentBrandingSnapshot(),slug);
 return <StoreBrandProvider brand={{...brand,name:brand.name||shop.name}}>{children}</StoreBrandProvider>;
}
