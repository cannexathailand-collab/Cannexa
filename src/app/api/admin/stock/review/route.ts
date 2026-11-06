import {NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {baseUrl} from '@/lib/config';
import {actOnStockReview,type StockReviewAction} from '@/lib/stock-review-actions';
export const maxDuration=60;
export async function POST(req:Request){
 let actor:string;try{actor=await admin(approvers);await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 const f=await req.formData(),id=String(f.get('orderId')??''),action=String(f.get('action')??''),reason=String(f.get('reason')??'').trim();
 if(!id||id.length>200||!['wait','cancel','retry'].includes(action)||reason.length>500||action==='cancel'&&(!reason||f.get('confirm')!=='yes'))return new Response('Invalid action',{status:400});
 let result='updated';
 try{await actOnStockReview(id,action as StockReviewAction,actor,reason||'ผู้ดูแลเลือกให้รอจัดส่ง');}
 catch(e){result=e instanceof Error&&e.message==='STOCK_RESULT_NEEDS_VERIFICATION'?'verify-first':'failed';}
 return NextResponse.redirect(baseUrl()+'/admin/stock/review?result='+result,303);
}
