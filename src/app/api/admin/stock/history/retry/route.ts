import {NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {closeStockDay} from '@/lib/stock-history';
export const maxDuration=60;
export async function POST(){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 let status='saved';try{await closeStockDay(actor);}catch(e){status=e instanceof Error&&e.message==='STOCK_BUSY'?'busy':'failed';}
 return NextResponse.redirect(baseUrl()+'/admin/stock/history?status='+status,303);
}
