import {z} from 'zod';
import {transaction,userLock} from './db';
import {stockCode} from './stock-code';
import {readStockSheet} from './stock-google';

const linkUrl=z.union([z.literal(''),z.string().max(2048).url().refine(value=>{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;})]);
const input=z.object({code:stockCode,name:z.string().max(200),text:z.string().trim().max(60),linkUrl:linkUrl.default(''),version:z.string().max(100).default('')});
export async function saveStockDescription(actor:string,value:unknown,readSource:typeof readStockSheet=readStockSheet){
 const parsed=input.parse(value);
 const product=(await readSource()).products.find(product=>product.code===parsed.code);
 if(!product)throw Error('PRODUCT_NOT_FOUND');
 if((product.name??'')!==parsed.name)throw Error('PRODUCT_CHANGED');
 return transaction(async tx=>{
  await userLock(tx,'stock-description:'+product.code);
  const before=await tx.stockProductDescription.findUnique({where:{code:product.code}});
  if((before?.updatedAt.toISOString()??'')!==parsed.version)throw Error('DESCRIPTION_CHANGED');
  const record={name:parsed.name,text:parsed.text,linkUrl:parsed.linkUrl,editedBy:actor};
  const saved=await tx.stockProductDescription.upsert({where:{code:product.code},create:{code:product.code,...record},update:record});
  await tx.auditLog.create({data:{actor,action:'STOCK_DESCRIPTION_UPDATED',entityId:product.code,details:{before:before?.text??'',after:record.text,beforeLink:before?.linkUrl??'',afterLink:record.linkUrl}}});
  return {code:product.code,text:record.text,linkUrl:record.linkUrl,version:saved.updatedAt.toISOString()};
 });
}
