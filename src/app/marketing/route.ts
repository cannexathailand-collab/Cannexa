import {NextRequest} from 'next/server';
import {startCustomerMarketing} from '@/lib/customer-marketing';
export async function GET(request:NextRequest){return startCustomerMarketing(request);}
