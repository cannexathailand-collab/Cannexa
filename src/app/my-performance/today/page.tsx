import {redirect} from 'next/navigation';
export default async function LegacyToday({searchParams}:{searchParams:Promise<{status?:string;q?:string;page?:string;scope?:string}>}){
 const input=await searchParams,query=new URLSearchParams();
 for(const key of ['status','q','page','scope'] as const)if(input[key])query.set(key,input[key]);
 redirect('/my-performance/orders'+(query.size?'?'+query.toString():''));
}
