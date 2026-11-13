import {z} from 'zod';
import {transaction,userLock} from './db';
import {stockCode} from './stock-code';
import {readStockSheet} from './stock-google';
const input=z.object({code:stockCode,name:z.string().max(200),description:z.string().trim().max(2000),version:z.string().max(100).default('')});
export async function saveCustomerProductDescription(actor:string,value:unknown,readSource:typeof readStockSheet=readStockSheet){
 const parsed=input.parse(value),product=(await readSource()).products.find(product=>product.code===parsed.code);
 if(!product)throw Error('PRODUCT_NOT_FOUND');
 if((product.name??'')!==parsed.name)throw Error('PRODUCT_CHANGED');
 return transaction(async tx=>{
  await userLock(tx,'customer-product-description:'+product.code);
  const before=await tx.customerProductDescription.findUnique({where:{code:product.code}});
  if((before?.updatedAt.toISOString()??'')!==parsed.version)throw Error('DESCRIPTION_CHANGED');
  const data={name:parsed.name,description:parsed.description,editedBy:actor};
  const saved=await tx.customerProductDescription.upsert({where:{code:product.code},create:{code:product.code,...data},update:data});
  await tx.auditLog.create({data:{actor,action:'CUSTOMER_PRODUCT_DESCRIPTION_UPDATED',entityId:product.code,details:{before:before?.description??'',after:data.description}}});
  return {description:saved.description,version:saved.updatedAt.toISOString()};
 });
}
