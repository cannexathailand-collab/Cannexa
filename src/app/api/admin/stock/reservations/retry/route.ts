import {NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {baseUrl} from '@/lib/config';
import {processPendingReservations} from '@/lib/stock-flow';
export const maxDuration=60;
export async function POST(){
 try{await admin(approvers);await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 await processPendingReservations(2);
 return NextResponse.redirect(baseUrl()+'/admin/stock',303);
}
