import {activeShop} from '@/lib/shop-session';
import {shopDatabase} from '@/lib/platform-shops';
import {withDatabase} from '@/lib/db';
import {documentLogoResponse} from '@/lib/document-branding';
export async function GET(_request:Request,{params}:{params:Promise<{slug:string;version:string}>}){
 const {slug,version}=await params,shop=await activeShop(slug);if(!shop)return new Response('Not found',{status:404});
 return withDatabase(shopDatabase(shop.schemaName),()=>documentLogoResponse(version),slug);
}
