import {Prisma} from '@prisma/client';
import {currentDatabaseSchema} from './db';
import {contactPhones} from './contact-phones';

export async function matchingCustomerPhones(tx:Prisma.TransactionClient,phone:string){
 const variants=contactPhones(phone).flatMap(number=>[number,'66'+number.slice(1)]);
 const schema=currentDatabaseSchema();
 if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema))throw Error('INVALID_SCHEMA');
 const customers=Prisma.raw('"'+schema+'"."Customer"'),orders=Prisma.raw('"'+schema+'"."OrderIntake"');
 const rows=await tx.$queryRaw<{code:string}[]>(Prisma.sql`SELECT DISTINCT c.code FROM ${customers} c LEFT JOIN ${orders} o ON o."customerCode"=c.code WHERE NOT (c."profileResetAt" IS NOT NULL AND c."portalProfileIncomplete") AND (regexp_split_to_array(regexp_replace(COALESCE(c.phone,''),'[^0-9/,;|]','','g'),'[/,;|]+') && ARRAY[${Prisma.join(variants)}]::text[] OR regexp_split_to_array(regexp_replace(COALESCE(c."registrationPhone",''),'[^0-9/,;|]','','g'),'[/,;|]+') && ARRAY[${Prisma.join(variants)}]::text[] OR ((c."profileResetAt" IS NULL OR o."eventAt">c."profileResetAt") AND regexp_split_to_array(regexp_replace(COALESCE(o.phone,''),'[^0-9/,;|]','','g'),'[/,;|]+') && ARRAY[${Prisma.join(variants)}]::text[])) ORDER BY c.code LIMIT 20`);
 return tx.customer.findMany({where:{code:{in:rows.map(row=>row.code)}},orderBy:{createdAt:'asc'},select:{code:true,name:true,phone:true,address:true}});
}
