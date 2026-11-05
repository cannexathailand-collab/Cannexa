import {randomBytes} from 'node:crypto';
import {db,transaction,userLock} from './db';import {userKey} from './crypto';import {parseExpenseText} from './expense-parser';import type {OrderEvent} from './order-intake';
export async function receiveExpenseEvent(botId:string,e:OrderEvent){
 if(e.source.type!=='group'||!e.source.groupId)return;
 const groupKey=userKey('order-group:'+botId+':'+e.source.groupId),group=await db.orderGroup.findUnique({where:{id:groupKey}});if(group?.purpose!=='EXPENSE')return;
 const messageId=e.type==='unsend'?e.unsend?.messageId:e.message?.id;if(!messageId)return;
 if(e.type!=='unsend'&&(!group.enabled||e.type!=='message'||e.message?.type!=='text'||!e.message.text))return;
 const parsed=e.type==='message'?parseExpenseText(e.message!.text!):null;if(e.type!=='unsend'&&!parsed)return;
 const messageKey=userKey('expense-message:'+botId+':'+messageId),eventKey=userKey('expense-event:'+botId+':'+e.webhookEventId);
 await transaction(async tx=>{
  await userLock(tx,messageKey);const existing=await tx.expense.findUnique({where:{messageKey}});
  if(e.type==='unsend'){
   if(existing?.status==='WITHDRAWN')return;
   const row=await tx.expense.upsert({where:{messageKey},create:{messageKey,eventKey,groupKey,expenseNumber:'EXP-'+randomBytes(8).toString('hex').toUpperCase(),status:'WITHDRAWN',issues:[],eventAt:new Date(e.timestamp)},update:{status:'WITHDRAWN',rawText:null,bankAccount:null,bankName:null,recipient:null,description:null}});
   await tx.auditLog.create({data:{actor:'line-expense',action:'EXPENSE_WITHDRAWN',entityId:row.id,details:{previousStatus:existing?.status??null,amountSatang:existing?.amountSatang??null}}});return;
  }
  if(existing||await tx.expense.findUnique({where:{eventKey}}))return;
  const current=await tx.orderGroup.findUnique({where:{id:groupKey}});if(!current?.enabled||current.purpose!=='EXPENSE')return;
  const row=await tx.expense.create({data:{messageKey,eventKey,groupKey,expenseNumber:'EXP-'+randomBytes(8).toString('hex').toUpperCase(),...parsed!,rawText:e.message!.text!,status:parsed!.issues.length?'NEEDS_REVIEW':'PAID',paidAt:parsed!.issues.length?null:new Date(e.timestamp),eventAt:new Date(e.timestamp)}});
  await tx.auditLog.create({data:{actor:'line-expense',action:row.status==='PAID'?'EXPENSE_RECORDED_PAID':'EXPENSE_NEEDS_REVIEW',entityId:row.id,details:{groupKey,amountSatang:row.amountSatang}}});
 });
}
