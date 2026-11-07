import {PrismaClient,Prisma} from "@prisma/client";
const g=globalThis as unknown as {prisma?:PrismaClient};
export const db=g.prisma??new PrismaClient();
if(process.env.NODE_ENV!=="production")g.prisma=db;
export async function transaction<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>,timeout=15000):Promise<T>{
 for(let i=0;;i++){try{return await db.$transaction(fn,{isolationLevel:"Serializable",timeout});}
 catch(e){if(i<4&&e instanceof Prisma.PrismaClientKnownRequestError&&["P2034","P2002"].includes(e.code))continue;throw e;}}
}
export async function userLock(tx:Prisma.TransactionClient,key:string){await tx.$queryRawUnsafe("SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))",key);}
