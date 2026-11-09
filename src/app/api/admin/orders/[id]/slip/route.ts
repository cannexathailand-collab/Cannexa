import {admin} from '@/lib/auth';
import {db} from '@/lib/db';

const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{await admin();}catch{return new Response('Forbidden',{status:403,headers});}
 const {id}=await params,version=new URL(request.url).searchParams.get('v');
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(id)||!version||!/^[a-f0-9]{64}$/.test(version))return new Response('Not found',{status:404,headers});
 const slip=await db.orderPaymentSlip.findUnique({where:{orderId:id}});
 if(!slip||slip.version!==version||!['image/jpeg','image/png','image/webp'].includes(slip.mime))return new Response('Not found',{status:404,headers});
 return new Response(new Uint8Array(slip.data),{headers:{...headers,'Content-Type':slip.mime}});
}
