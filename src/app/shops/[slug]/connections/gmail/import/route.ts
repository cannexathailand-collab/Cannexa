import {NextResponse,after} from 'next/server';
import {sameOrigin} from '@/lib/auth';
import {withShopMutation} from '@/lib/shop-workspace';
import {shopPath} from '@/lib/shop-session';
import {baseUrl} from '@/lib/config';
import {importGmailReports,matchShipments} from '@/lib/gmail-reports';
import {bindDatabase} from '@/lib/db';
import {processPendingStockDispatches} from '@/lib/stock-dispatch';
export const maxDuration=60;
export async function POST(_request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();const {slug}=await params;
 return withShopMutation(slug,async({account})=>{
  let status='imported';
  try{await importGmailReports(account.username);await matchShipments(account.username);after(bindDatabase(async()=>{await processPendingStockDispatches(account.username,1)}));}catch{status='import-error';}
  return NextResponse.redirect(baseUrl()+shopPath(slug)+'/connections?status='+status,303);
 });
}
