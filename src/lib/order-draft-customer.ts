import {db} from './db';
import {canonicalCustomerCode,displayCustomerCode} from './customer-code';
export async function orderDraftCustomer(code:string){
 const normalized=code.trim().toUpperCase(),canonical=canonicalCustomerCode(normalized);
 const customer=await db.customer.findUnique({where:{code:canonical}})??(canonical!==normalized?await db.customer.findUnique({where:{code:normalized}}):null);
 if(!customer)return null;
 const latest=await db.orderIntake.findFirst({where:{customerCode:customer.code,status:{notIn:['WITHDRAWN','CANCELLED']}},orderBy:{createdAt:'desc'},select:{recipient:true,phone:true,address:true,createdAt:true}});
 return {customerCode:displayCustomerCode(customer.code),recipient:customer.name||latest?.recipient||'',phone:customer.phone||latest?.phone||'',address:latest?.address??'',addressDate:latest?.createdAt??null};
}
