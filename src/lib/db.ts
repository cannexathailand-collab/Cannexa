import {PrismaClient,Prisma} from "@prisma/client";
import {AsyncLocalStorage} from 'node:async_hooks';
const g=globalThis as unknown as {prisma?:PrismaClient};
const primaryDatabase=g.prisma??new PrismaClient();
if(process.env.NODE_ENV!=="production")g.prisma=primaryDatabase;
const databaseScope=new AsyncLocalStorage<{client:PrismaClient;slug?:string}>();
const databaseSchemas=new WeakMap<PrismaClient,string>();
export function registerDatabaseSchema(client:PrismaClient,schema:string){databaseSchemas.set(client,schema);}
export function currentDatabaseSchema(){
 const client=databaseScope.getStore()?.client;
 if(client&&client!==primaryDatabase){
  const schema=databaseSchemas.get(client);
  if(!schema)throw Error('UNREGISTERED_SHOP_DATABASE');
  return schema;
 }
 return new URL(process.env.DATABASE_URL!).searchParams.get('schema')||'public';
}
export const db=new Proxy(primaryDatabase,{
 get(target,key){
  const client=databaseScope.getStore()?.client??target;
  const value=Reflect.get(client,key,client);
  return typeof value==='function'?value.bind(client):value;
 },
});
export function withDatabase<T>(client:PrismaClient,work:()=>T,slug?:string):T{
 return databaseScope.run({client:client===db?primaryDatabase:client,slug},work);
}
export function isSeparateShopDatabase(){const client=databaseScope.getStore()?.client;return !!client&&client!==primaryDatabase;}
export function currentShopSlug(){return databaseScope.getStore()?.slug;}
export function bindDatabase<T extends unknown[],R>(work:(...args:T)=>R){
 const scope=databaseScope.getStore();
 return (...args:T)=>scope?databaseScope.run(scope,()=>work(...args)):work(...args);
}
export async function transaction<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>,timeout=15000):Promise<T>{
 for(let i=0;;i++){try{return await db.$transaction(fn,{isolationLevel:"Serializable",timeout});}
 catch(e){if(i<4&&e instanceof Prisma.PrismaClientKnownRequestError&&["P2034","P2002"].includes(e.code))continue;throw e;}}
}
export async function userLock(tx:Prisma.TransactionClient,key:string){await tx.$queryRawUnsafe("SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))",key);}
