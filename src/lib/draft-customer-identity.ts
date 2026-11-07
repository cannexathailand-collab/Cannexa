import {Prisma} from '@prisma/client';
import {db,transaction,userLock} from './db';
import {normalizePhone} from './shipment-matching';
import {customerIdentity} from './order-customer';
import {displayCustomerCode} from './customer-code';
type Client=Prisma.TransactionClient;
export function validCustomerPhone(value:string){const phone=normalizePhone(value);return /^0\d{9}$/.test(phone)&&!/^0+$/.test(phone)?phone:null;}
async function matches(tx:Client,phone:string){
 const international='66'+phone.slice(1);
 const schema=new URL(process.env.DATABASE_URL!).searchParams.get('schema')??'public';if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema))throw Error('INVALID_SCHEMA');
 const customers=Prisma.raw('"'+schema+'"."Customer"'),orders=Prisma.raw('"'+schema+'"."OrderIntake"');
 const rows=await tx.$queryRaw<{code:string}[]>(Prisma.sql`SELECT DISTINCT c.code FROM ${customers} c LEFT JOIN ${orders} o ON o."customerCode"=c.code WHERE regexp_replace(COALESCE(c.phone,''),'[^0-9]','','g') IN (${phone},${international}) OR regexp_replace(COALESCE(o.phone,''),'[^0-9]','','g') IN (${phone},${international}) ORDER BY c.code LIMIT 20`);
 return tx.customer.findMany({where:{code:{in:rows.map(r=>r.code)}},orderBy:{createdAt:'asc'},select:{code:true,name:true,phone:true,address:true}});
}
const publicRows=(rows:Awaited<ReturnType<typeof matches>>)=>rows.map(r=>({customerCode:displayCustomerCode(r.code),recipient:r.name??'',phone:r.phone??''}));
export async function searchDraftCustomers(phoneInput:string){
 const phone=validCustomerPhone(phoneInput);if(!phone)throw Error('INVALID_PHONE');
 return publicRows(await matches(db,phone));
}
export async function createDraftCustomer(input:{name:string;phone:string;address?:string},actor:{username:string;affiliateId:string|null}){
 const name=input.name.trim(),phone=validCustomerPhone(input.phone),address=(input.address??'').trim();
 if(!name||name.length>200||!phone||address.length>2000)throw Error('INVALID_CUSTOMER');
 return transaction(async tx=>{
  await userLock(tx,'draft-customer-phone:'+phone);
  const found=await matches(tx,phone);if(found.length)return {created:false,customers:publicRows(found)};
  const row=await tx.customer.create({data:{name,phone,address:address||null,identityKey:customerIdentity(name,phone),referrerId:actor.affiliateId}});
  await tx.auditLog.create({data:{actor:actor.username,action:'DRAFT_CUSTOMER_CREATED',entityId:row.code,details:{source:'order-draft'}}});
  return {created:true,customer:{customerCode:displayCustomerCode(row.code),recipient:row.name??'',phone:row.phone??'',address:row.address??''}};
 });
}
