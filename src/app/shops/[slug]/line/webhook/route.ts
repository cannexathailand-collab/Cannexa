import {NextRequest} from 'next/server';
import {activeShop} from '@/lib/shop-session';
import {shopDatabase} from '@/lib/platform-shops';
import {withDatabase} from '@/lib/db';
import {POST as receiveLineWebhook} from '@/app/api/line/webhook/route';
export const maxDuration=60;
export async function POST(request:NextRequest,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params,shop=await activeShop(slug);
 if(!shop)return new Response('Not found',{status:404});
 return withDatabase(shopDatabase(shop.schemaName),()=>receiveLineWebhook(request),slug);
}
