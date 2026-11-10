import {z} from 'zod';
import {transaction,userLock} from './db';
import {sha} from './crypto';
import {admitOrderText} from './order-intake';
import {parseOrderText} from './order-parser';
import {isEmployeeRole} from './accounts';
import {orderRejectionReasons} from './order-validation';

const input=z.object({requestKey:z.uuid(),text:z.string().trim().min(1).max(10000)});
export async function saveShopOrder(value:unknown,actor:{username:string;role:string}){
 const data=input.parse(value),parsed=parseOrderText(data.text);
 if(!parsed)throw Error('INVALID_ORDER');
 if(orderRejectionReasons(parsed).length)throw Error('INVALID_ORDER');
 if(isEmployeeRole(actor.role)&&parsed.sellerCode.toLowerCase()!==actor.username.toLowerCase())throw Error('INVALID_SELLER');
 const key='manual:'+sha(data.requestKey);
 return transaction(async tx=>{
  await userLock(tx,key);
  const previous=await tx.orderIntake.findUnique({where:{messageKey:key}});
  if(previous){if(previous.rawText!==data.text)throw Error('ORDER_CHANGED');return previous;}
  const result=await admitOrderText(tx,{text:data.text,eventKey:key,messageKey:key,groupKey:'manual',senderKey:actor.username,eventAt:new Date(),actor:actor.username});
  if('reasons' in result)throw Error('ORDER_REJECTED');
  await tx.auditLog.create({data:{actor:actor.username,action:'ORDER_CREATED',entityId:result.order.id,details:{source:'shop'}}});
  return result.order;
 });
}
