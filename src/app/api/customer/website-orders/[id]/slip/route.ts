import {currentAccount} from '@/lib/auth';
import {portalCustomer,hasPortalAccess} from '@/lib/customer-portal';
import {db} from '@/lib/db';

const privateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 let owner=false,customerCode:string|null=null;
 try{owner=(await currentAccount()).role==='owner';}
 catch(error){if(!(error instanceof Error)||error.message!=='UNAUTHORIZED')throw error;}
 if(!owner){
  const {key,customer}=await portalCustomer();
  if(!customer||!await hasPortalAccess(key,customer.code))return new Response('Forbidden',{status:403,headers:privateHeaders});
  customerCode=customer.code;
 }
 const {id}=await params,version=new URL(request.url).searchParams.get('v');
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(id)||!version||!/^[a-f0-9]{64}$/.test(version))return new Response('Not found',{status:404,headers:privateHeaders});
 const order=await db.websiteOrder.findFirst({
  where:{id,...(!owner?{customerCode:customerCode!}:{})},
  select:{slipData:true,slipMime:true,slipVersion:true},
 });
 if(!order?.slipData||order.slipVersion!==version||!['image/png','image/jpeg','image/webp'].includes(order.slipMime??''))return new Response('Not found',{status:404,headers:privateHeaders});
 return new Response(new Uint8Array(order.slipData),{headers:{...privateHeaders,'Content-Type':order.slipMime!}});
}
