import {currentAccount,sameOrigin} from '@/lib/auth';
import {db} from '@/lib/db';
import {portalCustomer,hasPortalAccess} from '@/lib/customer-portal';
import {attachOrderPaymentSlip} from '@/lib/order-payment-slip';

const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params,version=new URL(request.url).searchParams.get('v');
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(id)||!version||!/^[a-f0-9]{64}$/.test(version))return new Response('Not found',{status:404,headers});
 let staff=false;
 try{staff=['owner','admin','manager','viewer','employee','sales','store'].includes((await currentAccount()).role);}catch(error){if(!(error instanceof Error)||error.message!=='UNAUTHORIZED')throw error;}
 if(!staff){
  const {key,customer}=await portalCustomer();
  if(!customer||!await hasPortalAccess(key,customer.code)||!await db.orderIntake.findFirst({where:{id,customerCode:customer.code},select:{id:true}}))return new Response('Forbidden',{status:403,headers});
 }
 const slip=await db.orderPaymentSlip.findUnique({where:{orderId:id}});
 if(!slip||slip.version!==version||!['image/jpeg','image/png','image/webp'].includes(slip.mime))return new Response('Not found',{status:404,headers});
 return new Response(new Uint8Array(slip.data),{headers:{...headers,'Content-Type':slip.mime}});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 let actor;
 try{actor=await currentAccount();await sameOrigin();}catch{return Response.json({error:'ไม่อนุญาตให้แนบสลิป'},{status:403,headers});}
 const {id}=await params;
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))return Response.json({error:'ไม่พบออเดอร์'},{status:404,headers});
 const text=await request.text();
 if(text.length>2800000)return Response.json({error:'รูปสลิปต้องไม่เกิน 2 MB'},{status:413,headers});
 try{
  const input=JSON.parse(text);if(typeof input.image!=='string')throw Error('INVALID_REWARD_IMAGE');
  await attachOrderPaymentSlip(actor,id,input.image);
  return Response.json({ok:true},{headers});
 }catch(error){
  const reason=error instanceof Error?error.message:'';
  return Response.json({error:reason==='SLIP_EXISTS'?'ออเดอร์นี้มีสลิปแล้ว กรุณาโหลดหน้าใหม่':reason==='FORBIDDEN'?'ไม่อนุญาตให้แก้ไขออเดอร์นี้':reason==='ORDER_CLOSED'?'ออเดอร์นี้ไม่สามารถแนบสลิปได้':'บันทึกไม่สำเร็จ กรุณาใช้รูป JPG, PNG หรือ WebP ไม่เกิน 2 MB'},{status:reason==='FORBIDDEN'?403:reason==='SLIP_EXISTS'?409:400,headers});
 }
}
