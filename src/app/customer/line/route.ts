import {NextResponse} from 'next/server';
import {baseUrl} from '@/lib/config';

export const dynamic='force-dynamic';
export async function GET(){
 return NextResponse.redirect(baseUrl()+'/api/customer/login');
}
