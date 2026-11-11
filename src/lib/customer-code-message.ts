import {transaction,userLock} from './db';
export async function syncLoginCustomer(key:string,conversion:{id:string;customerCode:string;affiliateId:string},metaFbc:string|null){
 return transaction(async tx=>{
  await userLock(tx,key);
  const row=await tx.customer.upsert({where:{code:conversion.customerCode},create:{code:conversion.customerCode,lineUserKey:key,conversionId:conversion.id,referrerId:conversion.affiliateId,metaFbc},update:{lineUserKey:key,conversionId:conversion.id}});
  return !row.referrerId?tx.customer.update({where:{code:row.code},data:{referrerId:conversion.affiliateId,metaFbc:row.metaFbc??metaFbc}}):row;
 });
}
