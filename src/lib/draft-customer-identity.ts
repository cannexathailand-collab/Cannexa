import {Prisma} from '@prisma/client';
import {db,transaction,userLock} from './db';
import {contactPhones,validContactPhones} from './contact-phones';
import {customerIdentity} from './order-customer';
import {displayCustomerCode} from './customer-code';
type Client=Prisma.TransactionClient;
export function validCustomerPhone(value:string){const phones=validContactPhones(value);return phones?phones.join(' / '):null;}
export async function matchingCustomerPhones(tx:Client,phone:string){
 const variants=contactPhones(phone).flatMap(number=>[number,'66'+number.slice(1)]);
 const schema=new URL(process.env.DATABASE_URL!).searchParams.get('schema')??'public';if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema))throw Error('INVALID_SCHEMA');
 const customers=Prisma.raw('"'+schema+'"."Customer"'),orders=Prisma.raw('"'+schema+'"."OrderIntake"');
 const rows=await tx.$queryRaw<{code:string}[]>(Prisma.sql`SELECT DISTINCT c.code FROM ${customers} c LEFT JOIN ${orders} o ON o."customerCode"=c.code WHERE regexp_split_to_array(regexp_replace(COALESCE(c.phone,''),'[^0-9/,;|]','','g'),'[/,;|]+') && ARRAY[${Prisma.join(variants)}]::text[] OR regexp_split_to_array(regexp_replace(COALESCE(o.phone,''),'[^0-9/,;|]','','g'),'[/,;|]+') && ARRAY[${Prisma.join(variants)}]::text[] ORDER BY c.code LIMIT 20`);
 return tx.customer.findMany({where:{code:{in:rows.map(r=>r.code)}},orderBy:{createdAt:'asc'},select:{code:true,name:true,phone:true,address:true}});
}
const publicRows=(rows:Awaited<ReturnType<typeof matchingCustomerPhones>>)=>rows.map(r=>({customerCode:displayCustomerCode(r.code),recipient:r.name??'',phone:r.phone??''}));
export async function searchDraftCustomers(phoneInput:string){
 const phone=validCustomerPhone(phoneInput);if(!phone)throw Error('INVALID_PHONE');
 return publicRows(await matchingCustomerPhones(db,phone));
}
export async function createDraftCustomer(input:{name:string;phone:string;address?:string},actor:{username:string;affiliateId:string|null}){
 const name=input.name.trim(),phone=validCustomerPhone(input.phone),address=(input.address??'').trim();
 if(!name||name.length>200||!phone||address.length>2000)throw Error('INVALID_CUSTOMER');
 return transaction(async tx=>{
  for(const number of contactPhones(phone).sort())await userLock(tx,'draft-customer-phone:'+number);
  const found=await matchingCustomerPhones(tx,phone);if(found.length)return {created:false,customers:publicRows(found)};
  const row=await tx.customer.create({data:{name,phone,address:address||null,identityKey:customerIdentity(name,phone)}});
  await tx.auditLog.create({data:{actor:actor.username,action:'DRAFT_CUSTOMER_CREATED',entityId:row.code,details:{source:'order-draft'}}});
  return {created:true,customer:{customerCode:displayCustomerCode(row.code),recipient:row.name??'',phone:row.phone??'',address:row.address??''}};
 });
}
