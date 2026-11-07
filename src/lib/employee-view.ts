import {cookies} from 'next/headers';
import {readToken} from './crypto';
import {db} from './db';
import {requireAdminPage} from './auth';

export const ownerEmployeeCookie='owner_employee_view';

export async function selectedEmployee(actor:{role:string;username:string;version:string}){
 if(actor.role!=='owner')return null;
 const token=readToken<{purpose?:string;owner?:string;version?:string;username?:string;exp?:number}>((await cookies()).get(ownerEmployeeCookie)?.value??'');
 if(token?.purpose!=='OWNER_EMPLOYEE_VIEW'||token.owner!==actor.username||token.version!==actor.version||typeof token.username!=='string'||token.username.length>64||typeof token.exp!=='number'||token.exp<=Date.now())return null;
 return db.userAccount.findFirst({where:{username:token.username,role:'employee',active:true},select:{username:true,affiliateId:true}});
}

export async function requireEmployeePage(){
 const actor=await requireAdminPage(['employee']);
 const employee=await selectedEmployee(actor);
 // This changes report scope only. Authorization and API audit identity remain the owner.
 return employee?{...actor,username:employee.username,affiliateId:employee.affiliateId}:actor;
}
