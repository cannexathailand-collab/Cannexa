import {randomUUID} from "node:crypto";
import {transaction} from "./db";
export async function renameUser(original:string,next:string,actor:string){
 next=next.trim().toLowerCase();
 if(!/^[a-z0-9._-]{3,64}$/.test(original)||!/^[a-z0-9._-]{3,64}$/.test(next)||original==="owner"||next==="owner"||original===actor)throw new Error("INVALID_USERNAME");
 if(original===next)return;
 await transaction(async tx=>{
  const account=await tx.userAccount.findUnique({where:{username:original},select:{username:true,role:true}});
  if(!account||account.role==="owner")throw new Error("INVALID_ACCOUNT");
  if(await tx.userAccount.findUnique({where:{username:next},select:{username:true}}))throw new Error("USERNAME_EXISTS");
  await tx.userAccount.update({where:{username:original},data:{username:next,version:randomUUID()}});
  await tx.auditLog.create({data:{actor,action:"USERNAME_CHANGED",entityId:next,details:{previousUsername:original,username:next}}});
 });
}
