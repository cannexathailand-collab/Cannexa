import {currentAccount,sameOrigin} from '@/lib/auth';
import {searchDraftCustomers,createDraftCustomer} from '@/lib/draft-customer-identity';
import {limit} from '@/lib/rate-limit';
import {userKey} from '@/lib/crypto';
export async function POST(req:Request){
 let actor:Awaited<ReturnType<typeof currentAccount>>;
 try{actor=await currentAccount();if(!['employee','owner','admin','manager'].includes(actor.role))throw Error();await sameOrigin();}catch{return Response.json({error:'กรุณาเข้าสู่ระบบ'},{status:403});}
 try{
  if(!await limit(userKey('draft-identity:'+actor.username),60))return Response.json({error:'ทำรายการบ่อยเกินไป กรุณารอสักครู่'},{status:429});
  const input=await req.json();if(typeof input.phone!=='string'||input.phone.length>40)return Response.json({error:'กรอกเบอร์โทรให้ถูกต้อง'},{status:400});
  if(input.action==='search')return Response.json({customers:await searchDraftCustomers(input.phone)},{headers:{'Cache-Control':'no-store'}});
  if(input.action!=='create'||typeof input.name!=='string'||input.address!==undefined&&typeof input.address!=='string')return Response.json({error:'กรอกชื่อและเบอร์โทรให้ครบ'},{status:400});
  const result=await createDraftCustomer({name:input.name,phone:input.phone,address:input.address},{username:actor.username,affiliateId:actor.affiliateId});
  return Response.json(result,{status:result.created?201:409,headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error&&['INVALID_PHONE','INVALID_CUSTOMER'].includes(e.message)?'กรอกชื่อและเบอร์โทรให้ถูกต้อง':'ทำรายการไม่สำเร็จ กรุณาลองใหม่'},{status:e instanceof Error&&['INVALID_PHONE','INVALID_CUSTOMER'].includes(e.message)?400:503});}
}
