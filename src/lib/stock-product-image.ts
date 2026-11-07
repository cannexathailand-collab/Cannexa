import {z} from 'zod';
import type {Prisma} from '@prisma/client';
import {db} from './db';
import {stockCode} from './stock-code';
import {parseRewardImage} from './crm-reward-image';
import {readStockSheet} from './stock-google';

const imageInput=z.object({code:stockCode,expectedVersion:z.string().regex(/^[a-f0-9]{64}$/).nullable(),image:z.string()});
const metadata={code:true,imageMime:true,imageVersion:true,createdAt:true,updatedAt:true} as const;

export async function saveStockProductImage(actor:string,value:unknown){
 const parsed=imageInput.safeParse(value);
 if(!parsed.success)throw Error('INVALID_STOCK_IMAGE');
 const input=parsed.data,image=parseRewardImage(input.image);
 return db.$transaction(async tx=>{
  const locks=await tx.$queryRawUnsafe<{locked:boolean}[]>('SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked','stock-sheet-add');
  if(!locks[0]?.locked)throw Error('STOCK_BUSY');
  const connection=await tx.stockSheetsConnection.findUnique({where:{id:'active'},select:{id:true}});
  const exists=connection?(await readStockSheet()).products.some(product=>product.code===input.code):!!await tx.stockProduct.findUnique({where:{code:input.code},select:{code:true}});
  if(!exists)throw Error('STOCK_PRODUCT_NOT_FOUND');
  const previous=await tx.stockProductImage.findUnique({where:{code:input.code},select:metadata});
  if(previous?.imageVersion===image.imageVersion)return previous;
  if((previous?.imageVersion??null)!==input.expectedVersion)throw Error('STOCK_IMAGE_VERSION_CONFLICT');
  const saved=await tx.stockProductImage.upsert({where:{code:input.code},create:{code:input.code,...image},update:image,select:metadata});
  await tx.auditLog.create({data:{actor,action:'STOCK_PRODUCT_IMAGE_UPDATED',entityId:input.code,details:{previousVersion:previous?.imageVersion??null,imageVersion:saved.imageVersion,imageMime:saved.imageMime,sizeBytes:image.imageData.length}}});
  return saved;
 },{timeout:55000,maxWait:10000});
}

export async function clearDeletedStockImages(tx:Prisma.TransactionClient,codes:string[],replayed=false){
 const images=await tx.stockProductImage.findMany({where:{code:{in:codes}},select:{code:true}});
 if(!images.length)return;
 const current=replayed?new Set((await readStockSheet()).products.map(product=>product.code)):null;
 const deleted=images.filter(image=>!current?.has(image.code)).map(image=>image.code);
 if(deleted.length)await tx.stockProductImage.deleteMany({where:{code:{in:deleted}}});
}
