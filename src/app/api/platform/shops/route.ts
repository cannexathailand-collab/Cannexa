import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {createPlatformShop,requirePlatformAdministrator} from '@/lib/platform-shops';
export const maxDuration=60;
export async function POST(request:Request){
 let actor;try{actor=await requirePlatformAdministrator();await sameOrigin()}catch{return new Response('Forbidden',{status:403})}
 try{const shop=await createPlatformShop(actor.username,Object.fromEntries(await request.formData()));return NextResponse.redirect(baseUrl()+'/platform?status=created&shop='+encodeURIComponent(shop.id),303)}
 catch{return NextResponse.redirect(baseUrl()+'/platform?status=error',303)}
}
