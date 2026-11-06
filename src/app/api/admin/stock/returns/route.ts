import {NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {baseUrl} from '@/lib/config';
import {confirmStockReturnReceived,processStockReturn} from '@/lib/stock-return';

export const maxDuration=60;
export async function POST(req:Request){
 let actor:string;try{actor=await admin(approvers);await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 let form:FormData;try{form=await req.formData();}catch{return new Response('Invalid form',{status:400});}
 const tracking=String(form.get('tracking')??'').trim().normalize('NFKC').toUpperCase().replace(/\s/g,''),action=String(form.get('action')??'');
 if(!/^[A-Z0-9-]{8,50}$/.test(tracking)||!['confirm','retry'].includes(action)||action==='confirm'&&form.get('receivedAll')!=='yes')return new Response('ต้องระบุเลขพัสดุและยืนยันว่าได้รับสินค้าคืนครบแล้ว',{status:400});
 let result='pending';
 try{
  if(action==='confirm')await confirmStockReturnReceived(tracking,actor);
  const processed=await processStockReturn(tracking,actor);
  if(processed.status==='POSTED')result='posted';else if(processed.status==='NO_STOCK_CHANGE')result='unchanged';
 }catch{result='failed';}
 return NextResponse.redirect(baseUrl()+'/admin/stock/review?returnResult='+result+'#stock-returns',303);
}
