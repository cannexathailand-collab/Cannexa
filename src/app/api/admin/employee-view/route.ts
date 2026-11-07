import {NextRequest,NextResponse} from 'next/server';
import {currentAccount,cookieOptions,sameOrigin} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {db} from '@/lib/db';
import {signToken} from '@/lib/crypto';
import {ownerEmployeeCookie} from '@/lib/employee-view';

export async function POST(request:NextRequest){
 try{
  await sameOrigin();
  const actor=await currentAccount();
  if(actor.role!=='owner')return new Response('Forbidden',{status:403});
  const form=await request.formData();
  const username=String(form.get('username')??'').trim();
  if(username.length>64)return new Response('Invalid employee',{status:400});
  const employee=username?await db.userAccount.findFirst({where:{username,role:'employee',active:true},select:{username:true}}):null;
  if(username&&!employee)return new Response('Invalid employee',{status:400});
  const response=NextResponse.redirect(baseUrl()+'/my-performance',303);
  if(employee)response.cookies.set(ownerEmployeeCookie,signToken({purpose:'OWNER_EMPLOYEE_VIEW',owner:actor.username,version:actor.version,username:employee.username,exp:Date.now()+86400000}),{...cookieOptions,maxAge:86400});
  else response.cookies.delete(ownerEmployeeCookie);
  return response;
 }catch{return new Response('Forbidden',{status:403});}
}
