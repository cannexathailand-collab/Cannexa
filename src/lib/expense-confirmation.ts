import {expenseItems} from './expense-items';
import {db} from './db';import {userKey} from './crypto';import {parseExpenseText} from './expense-parser';import type {OrderEvent} from './order-intake';
type ExpenseMessage={expenseNumber:string;description:string|null;amountSatang:number|null;status:string;issues:unknown;items?:unknown};
export function expenseConfirmationText(expense:ExpenseMessage){
 if(expense.status!=='PAID'||expense.amountSatang===null)return 'รับข้อความค่าใช้จ่ายแล้ว\nยังบันทึกค่าใช้จ่ายไม่สำเร็จ\nกรุณาตรวจ: '+(Array.isArray(expense.issues)?expense.issues.map(String).join(' · '):'ข้อมูลไม่ครบ')+'\nยกเลิกข้อความเดิมแล้วส่งใหม่ตามรูปแบบ';
 const items=expenseItems(expense);if(items.length<=1)return 'บันทึกค่าใช้จ่ายสำเร็จ\nรายการ: '+(items[0]?.description??expense.description??'รายจ่าย');
 let text='บันทึกค่าใช้จ่ายสำเร็จ\nรายการ:';let shown=0;for(const item of items){const line='\n• '+item.description;if(text.length+line.length>4500)break;text+=line;shown++;}if(shown<items.length)text+='\nและอีก '+(items.length-shown)+' รายการ ดูรายละเอียดในเว็บ';return text;
}
export async function replyExpenseConfirmation(botId:string,e:OrderEvent,accessToken?:string){
 if(e.type!=='message'||e.source.type!=='group'||e.message?.type!=='text'||!e.replyToken||!parseExpenseText(e.message.text??''))return;
 const messageKey=userKey('expense-message:'+botId+':'+e.message.id),expense=await db.expense.findUnique({where:{messageKey}});
 if(!expense||expense.status==='WITHDRAWN'||['SENT','SENDING'].includes(expense.replyStatus))return;
 if(!accessToken){await db.expense.updateMany({where:{id:expense.id,replyStatus:{not:'SENT'}},data:{replyStatus:'NOT_CONFIGURED',replyLastError:'ACCESS_TOKEN_MISSING'}});return;}
 const claim=await db.expense.updateMany({where:{id:expense.id,status:{not:'WITHDRAWN'},replyStatus:{in:['NOT_SENT','FAILED','NOT_CONFIGURED']},replyAttempts:{lt:2}},data:{replyStatus:'SENDING',replyAttempts:{increment:1},replyLastError:null}});if(!claim.count)return;
 try{const r=await fetch('https://api.line.me/v2/bot/message/reply',{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({replyToken:e.replyToken,messages:[{type:'text',text:expenseConfirmationText(expense)}]}),signal:AbortSignal.timeout(8000),cache:'no-store'});await db.expense.update({where:{id:expense.id},data:r.ok?{replyStatus:'SENT',repliedAt:new Date(),replyLastError:null}:{replyStatus:'FAILED',replyLastError:'LINE_HTTP_'+r.status}});}catch{await db.expense.update({where:{id:expense.id},data:{replyStatus:'FAILED',replyLastError:'DELIVERY_UNCONFIRMED'}});}
}
