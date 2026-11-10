import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {db,withDatabase} from './db';
import {equal,passwordHash,readToken} from './crypto';
import {shopDatabase,requirePlatformAdministrator} from './platform-shops';

export type ShopSession={audience:'shop';shopId:string;username:string;version:string;exp:number;platformActor?:string;platformVersion?:string;viewOnly?:boolean};
export function shopCookieName(shopId:string){return 'shop_session_'+shopId;}
export function shopViewCookieName(shopId:string){return 'shop_view_'+shopId;}
export function shopPath(slug:string){return '/shops/'+encodeURIComponent(slug);}
export function validShopSession(session:ShopSession|null,shopId:string,account:{username:string;version:string;active:boolean}|null,now=Date.now()){
 return !!session&&session.audience==='shop'&&session.shopId===shopId&&Number.isFinite(session.exp)&&session.exp>now&&!!account?.active&&session.username===account.username&&session.version===account.version;
}
export async function activeShop(slug:string){
 return withDatabase(db,()=>db.platformShop.findFirst({where:{slug,active:true}}));
}
export async function authenticateShop(slug:string,username:string,password:string){
 const shop=await activeShop(slug);
 if(!shop||username.length>64||password.length>256)return null;
 const account=await shopDatabase(shop.schemaName).userAccount.findUnique({where:{username}});
 const actual=passwordHash(password,account?.salt??'invalid-shop-account');
 if(!account?.active||!equal(actual,account.hash))return null;
 return {shop,account};
}
export async function requireShopAccount(slug:string){
 const shop=await activeShop(slug);
 if(!shop)redirect('/shops/'+encodeURIComponent(slug)+'/login');
 const jar=await cookies(),viewToken=jar.get(shopViewCookieName(shop.id))?.value;
 const token=viewToken??jar.get(shopCookieName(shop.id))?.value??'';
 const session=readToken<ShopSession>(token);
 const client=shopDatabase(shop.schemaName);
 // Reject a token for another shop before looking up any account in this schema.
 if(!session||session.audience!=='shop'||session.shopId!==shop.id||typeof session.username!=='string')redirect(shopPath(slug)+'/login');
 const account=await client.userAccount.findUnique({where:{username:session.username}});
 if(!validShopSession(session,shop.id,account))redirect(shopPath(slug)+'/login');
 if(viewToken){
  const actor=await withDatabase(db,()=>requirePlatformAdministrator());
  if(session.viewOnly!==true||session.platformActor!==actor.username||session.platformVersion!==actor.version)redirect('/platform');
 }
 return {shop,account:account!,client,readOnly:!!viewToken};
}
