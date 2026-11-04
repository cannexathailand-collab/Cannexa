import {transaction} from "./db";
export async function limit(key:string,max=10){return transaction(async tx=>{
 const now=new Date();const row=await tx.rateLimit.upsert({where:{key},create:{key,count:1,expiresAt:new Date(Date.now()+900000)},update:{count:{increment:1}}});
 if(row.expiresAt<now){await tx.rateLimit.update({where:{key},data:{count:1,expiresAt:new Date(Date.now()+900000)}});return true;}return row.count<=max;
});}
