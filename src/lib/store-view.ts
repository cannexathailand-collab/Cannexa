import {cookies} from 'next/headers';
import {readToken} from './crypto';
import {requireAdminPage} from './auth';
import {stockOperators,type Role} from './accounts';
export const storeViewCookie='owner_store_view';
export async function isOwnerStoreView(actor:{role:string;username:string;version:string}){
 if(actor.role!=='owner')return false;
 const token=readToken<{purpose?:string;owner?:string;version?:string;exp?:number}>((await cookies()).get(storeViewCookie)?.value??'');
 return token?.purpose==='OWNER_STORE_VIEW'&&token.owner===actor.username&&token.version===actor.version&&typeof token.exp==='number'&&token.exp>Date.now();
}
export async function requireStockPage(allowed:Role[]=stockOperators){
 const actor=await requireAdminPage(allowed);
 return await isOwnerStoreView(actor)?{...actor,role:'store'}:actor;
}
