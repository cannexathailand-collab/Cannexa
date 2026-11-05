import {db,transaction,userLock} from './db';import {commissionMonth} from './commission-month';import {dayStart,shiftMonth} from './sales-dates';import type {Prisma,RecurringExpense} from '@prisma/client';
export function recurringMonths(startMonth:string,lastGeneratedMonth:string|null,now=new Date()){
 if(!/^(?:19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(startMonth))throw Error('INVALID_START_MONTH');
 const current=commissionMonth(now),months:string[]=[];let month=lastGeneratedMonth?shiftMonth(lastGeneratedMonth+'-01',1).slice(0,7):startMonth;
 for(;month<=current;month=shiftMonth(month+'-01',1).slice(0,7))months.push(month);return months;
}
async function generate(tx:Prisma.TransactionClient,schedule:RecurringExpense,actor:string,now:Date){
 if(schedule.archivedAt)return 0;const months=recurringMonths(schedule.startMonth,schedule.lastGeneratedMonth,now);if(!months.length)return 0;
 const result=await tx.recurringExpenseEntry.createMany({data:months.map(month=>({recurringExpenseId:schedule.id,month,description:schedule.description,amountSatang:schedule.amountSatang,incurredAt:dayStart(month+'-01'),status:'RECORDED'})),skipDuplicates:true});
 await tx.recurringExpense.update({where:{id:schedule.id},data:{lastGeneratedMonth:months.at(-1)}});
 if(result.count)await tx.auditLog.create({data:{actor,action:'RECURRING_EXPENSE_RECORDED',entityId:schedule.id,details:{months,amountSatang:schedule.amountSatang,count:result.count}}});return result.count;
}
export async function addRecurringExpense(input:{requestKey:string;description:string;amountSatang:number;startMonth?:string},actor:string,now=new Date()){
 if(!/^[A-Za-z0-9-]{16,100}$/.test(input.requestKey)||!input.description.trim()||input.description.trim().length>300||!Number.isSafeInteger(input.amountSatang)||input.amountSatang<=0||input.amountSatang>2147483647)throw Error('INVALID_RECURRING_EXPENSE');const startMonth=shiftMonth(commissionMonth(now)+'-01',1).slice(0,7);
 return transaction(async tx=>{await userLock(tx,'recurring-create:'+input.requestKey);const existing=await tx.recurringExpense.findUnique({where:{requestKey:input.requestKey}});if(existing)return existing.id;
 const schedule=await tx.recurringExpense.create({data:{...input,startMonth,description:input.description.trim(),createdBy:actor}});await tx.auditLog.create({data:{actor,action:'RECURRING_EXPENSE_CREATED',entityId:schedule.id,details:{description:schedule.description,amountSatang:schedule.amountSatang,startMonth:schedule.startMonth}}});await generate(tx,schedule,actor,now);return schedule.id;});
}
export async function generateRecurringExpenses(actor:string,now=new Date()){
 const schedules=await db.recurringExpense.findMany({where:{archivedAt:null},select:{id:true}});let created=0;
 for(const schedule of schedules)created+=await transaction(async tx=>{await userLock(tx,'recurring-expense:'+schedule.id);const current=await tx.recurringExpense.findUniqueOrThrow({where:{id:schedule.id}});return generate(tx,current,actor,now);});return {schedules:schedules.length,created};
}
export async function removeRecurringExpense(id:string,actor:string,now=new Date()){
 await transaction(async tx=>{await userLock(tx,'recurring-expense:'+id);const schedule=await tx.recurringExpense.findUniqueOrThrow({where:{id}});if(schedule.archivedAt)return;
 await tx.recurringExpense.update({where:{id},data:{archivedAt:now}});await tx.auditLog.create({data:{actor,action:'RECURRING_EXPENSE_REMOVED',entityId:id,details:{description:schedule.description,recordedEntriesPreserved:true}}});});
}
