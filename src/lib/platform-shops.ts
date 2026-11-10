import {randomBytes,randomUUID} from 'node:crypto';
import {Prisma,PrismaClient} from '@prisma/client';
import {z} from 'zod';
import {db,transaction} from './db';
import {requireAccount} from './auth';
import {env} from './config';
import {passwordHash} from './crypto';

export async function requirePlatformAdministrator(){
 const account=await requireAccount();
 const permission=await db.platformAdministrator.findUnique({where:{username:account.username}});
 if(!permission?.active)throw Error('PLATFORM_FORBIDDEN');
 return account;
}
export const newShopSchema=z.object({
 name:z.string().trim().min(1).max(100),
 slug:z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/),
 ownerUsername:z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,64}$/),
 password:z.string().min(8).max(256),
});
function identifier(value:string){
 if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(value))throw Error('INVALID_SCHEMA_IDENTIFIER');
 return '"'+value+'"';
}
const storeTables=Prisma.dmmf.datamodel.models.filter(model=>!model.name.startsWith('Platform')).map(model=>model.dbName??model.name);
export async function createPlatformShop(actor:string,input:unknown){
 const data=newShopSchema.parse(input);
 if(['cannexa','admin','platform','api'].includes(data.slug))throw Error('SHOP_SLUG_RESERVED');
 const schemaName='shop_'+randomUUID().replaceAll('-','');
 const target=identifier(schemaName);
 const salt=randomBytes(32).toString('hex'),hash=passwordHash(data.password,salt);
 return transaction(async tx=>{
  if(!await tx.platformAdministrator.findFirst({where:{username:actor,active:true}}))throw Error('PLATFORM_FORBIDDEN');
  const shop=await tx.platformShop.create({data:{name:data.name,slug:data.slug,schemaName,ownerUsername:data.ownerUsername}});
  await tx.$executeRawUnsafe('CREATE SCHEMA '+target);
  for(const table of storeTables)await tx.$executeRawUnsafe('CREATE TABLE '+target+'.'+identifier(table)+' (LIKE public.'+identifier(table)+' INCLUDING ALL)');
  const constraints=await tx.$queryRaw<{table_name:string;constraint_name:string;definition:string}[]>`
   SELECT c.relname AS table_name, con.conname AS constraint_name, pg_get_constraintdef(con.oid) AS definition
   FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND con.contype='f'
  `;
  for(const constraint of constraints){
   if(!storeTables.includes(constraint.table_name))continue;
   const definition=constraint.definition.replace(/REFERENCES (?:public\.)?"([A-Za-z][A-Za-z0-9_]*)"/g,(_match,table:string)=>{
    if(!storeTables.includes(table))throw Error('CROSS_SCHEMA_REFERENCE');
    return 'REFERENCES '+target+'.'+identifier(table);
   });
   if(!definition.includes('REFERENCES '+target+'.'))throw Error('UNSUPPORTED_FOREIGN_KEY');
   await tx.$executeRawUnsafe('ALTER TABLE '+target+'.'+identifier(constraint.table_name)+' ADD CONSTRAINT '+identifier(constraint.constraint_name)+' '+definition);
  }
  await tx.$executeRawUnsafe('CREATE SEQUENCE '+target+'.customer_code_seq AS bigint MINVALUE 1 MAXVALUE 99999999 NO CYCLE');
  await tx.$executeRawUnsafe(`CREATE FUNCTION ${target}.customer_code() RETURNS text LANGUAGE sql VOLATILE AS $$ SELECT 'CUS-' || lpad(nextval('${target}.customer_code_seq'::regclass)::text,8,'0') $$`);
  for(const [table,column] of [['Customer','code'],['Conversion','customerCode']])await tx.$executeRawUnsafe('ALTER TABLE '+target+'.'+identifier(table)+' ALTER COLUMN '+identifier(column)+' SET DEFAULT '+target+'.customer_code()');
  await tx.$executeRawUnsafe('INSERT INTO '+target+'."UserAccount" (username,role,salt,hash,version,active,"affiliateId") VALUES ($1,$2,$3,$4,$5,true,NULL)',data.ownerUsername,'owner',salt,hash,randomUUID());
  await tx.platformAuditLog.create({data:{actor,action:'SHOP_CREATED',shopId:shop.id,details:{name:shop.name,slug:shop.slug}}});
  return shop;
 },60000);
}
const clients=new Map<string,PrismaClient>();
export function shopDatabase(schemaName:string){
 if(schemaName==='public')return db;
 if(!/^shop_[a-f0-9]{32}$/.test(schemaName))throw Error('INVALID_SHOP_SCHEMA');
 let client=clients.get(schemaName);
 if(!client){
  const url=new URL(env('DATABASE_URL'));url.searchParams.set('schema',schemaName);url.searchParams.set('connection_limit','2');
  client=new PrismaClient({datasources:{db:{url:url.toString()}}});clients.set(schemaName,client);
 }
 return client;
}
export async function platformShopData(actor:string,id:string){
 const shop=await db.platformShop.findUnique({where:{id}});
 if(!shop)throw Error('SHOP_NOT_FOUND');
 const client=shopDatabase(shop.schemaName);
 const [customers,orders,users]=await Promise.all([client.customer.count(),client.orderIntake.count(),client.userAccount.count()]);
 await db.platformAuditLog.create({data:{actor,action:'SHOP_VIEWED',shopId:id,details:{}}});
 return {shop,customers,orders,users};
}
