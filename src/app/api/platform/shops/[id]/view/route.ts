import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {sameOrigin,cookieOptions} from '@/lib/auth';
import {requirePlatformAdministrator,shopDatabase} from '@/lib/platform-shops';
import {shopPath,shopViewCookieName} from '@/lib/shop-session';
import {signToken} from '@/lib/crypto';
import {baseUrl} from '@/lib/config';
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
 await sameOrigin();
 let actor;try{actor=await requirePlatformAdministrator()}catch{return new Response('Forbidden',{status:403})}
 const {id}=await params,shop=await db.platformShop.findUnique({where:{id}});
 if(!shop?.active)return new Response('Not found',{status:404});
 const owner=await shopDatabase(shop.schemaName).userAccount.findUnique({where:{username:shop.ownerUsername}});
 if(!owner?.active||owner.role!=='owner')return new Response('Shop owner unavailable',{status:409});
 await db.platformAuditLog.create({data:{actor:actor.username,action:'SHOP_OWNER_VIEW_STARTED',shopId:shop.id,details:{}}});
 const response=NextResponse.redirect(baseUrl()+shopPath(shop.slug),303);
 response.cookies.set(shopViewCookieName(shop.id),signToken({audience:'shop',shopId:shop.id,username:owner.username,version:owner.version,platformActor:actor.username,platformVersion:actor.version,viewOnly:true,exp:Date.now()+30*60000}),{...cookieOptions,path:shopPath(shop.slug),maxAge:1800});
 return response;
}
