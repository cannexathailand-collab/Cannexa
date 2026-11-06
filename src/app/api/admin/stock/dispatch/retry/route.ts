import {NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {baseUrl} from '@/lib/config';
import {processPendingStockDispatches} from '@/lib/stock-dispatch';
export const maxDuration=60;
export async function POST(){let actor:string;try{actor=await admin(approvers);await sameOrigin();}catch{return new Response('Forbidden',{status:403});}await processPendingStockDispatches(actor,1);return NextResponse.redirect(baseUrl()+'/admin/expenses',303);}
