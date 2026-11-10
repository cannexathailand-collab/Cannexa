import {notFound} from 'next/navigation';
import {withDatabase} from './db';
import {requireShopAccount} from './shop-session';

export async function withShopWorkspace<T>(slug:string,work:(context:Awaited<ReturnType<typeof requireShopAccount>>)=>Promise<T>,roles:readonly string[]=['owner']){
 const context=await requireShopAccount(slug);
 if(!roles.includes(context.account.role))notFound();
 return withDatabase(context.client,()=>work(context),slug);
}
export async function withShopMutation<T>(slug:string,work:(context:Awaited<ReturnType<typeof requireShopAccount>>)=>Promise<T>,roles:readonly string[]=['owner']){
 const context=await requireShopAccount(slug);
 if(!roles.includes(context.account.role))return new Response('Forbidden',{status:403});
 if(context.readOnly)return new Response('โหมดดูข้อมูลไม่สามารถบันทึกการเปลี่ยนแปลงได้',{status:403});
 return withDatabase(context.client,()=>work(context),slug);
}
