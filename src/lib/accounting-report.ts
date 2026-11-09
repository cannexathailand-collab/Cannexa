import {db} from './db';
import {salesReport} from './sales-report';
import {expenseReport} from './expense-report';
import {accountingRange,summarizeAccounting,type AccountingFilters} from './accounting-summary';
import {dayStart,shiftDay} from './sales-dates';
import {accountingJournal} from './accounting-journal';
import {loadOrderRoundSettings} from './order-round-settings';
import {orderRoundBounds} from './order-round';

export async function accountingReport(input:AccountingFilters={}){
 const range=accountingRange(input);
 const settings=await loadOrderRoundSettings();
 const roundStart=orderRoundBounds(range.from,settings.closeMinutes).start,roundEnd=orderRoundBounds(range.to,settings.closeMinutes).end;
 const roundOrders=await db.orderIntake.findMany({where:{eventAt:{gte:roundStart,lt:roundEnd}},select:{id:true}});
 const [sales,expenses,pendingExpenses,pendingStock]=await Promise.all([
  salesReport(range),expenseReport(range),
  db.expense.count({where:{status:{in:['PENDING','NEEDS_REVIEW']},eventAt:{gte:dayStart(range.from),lt:dayStart(shiftDay(range.to,1))}}}),
  db.stockDispatch.count({where:{status:{in:['PENDING','NEEDS_REVIEW','WAITING_COST','HISTORY_SAVED']},orderId:{in:roundOrders.map(order=>order.id)}}})
 ]);
 const ids=sales.summary.rows.map(s=>s.orderId);
 const posted=await db.stockDispatch.findMany({where:{orderId:{in:ids},status:'POSTED'},select:{orderId:true}});
 const postedIds=new Set(posted.map(d=>d.orderId));
 const missingCosts=ids.filter(id=>!postedIds.has(id)).length;
 const summary=summarizeAccounting(range,sales.daily,expenses.entries,input.view);
 const notices:string[]=[];
 if(missingCosts)notices.push('ยอดขาย '+missingCosts+' ออเดอร์ยังไม่มีต้นทุนสินค้าบันทึกสำเร็จ กำไรยังไม่ครบ');
 if(pendingStock)notices.push('รายการตัดสต๊อก '+pendingStock+' ออเดอร์ยังประมวลผลต้นทุนไม่สำเร็จ');
 if(sales.summary.waitingCost)notices.push('ค่าคอม '+sales.summary.waitingCost+' ออเดอร์ยังรอคำนวณต้นทุน');
 if(sales.summary.pendingCommissionSatang)notices.push('ค่าคอมยอดขายรอจ่าย '+(sales.summary.pendingCommissionSatang/100).toFixed(2)+' บาท ยังไม่รวมในค่าใช้จ่ายที่จ่ายแล้ว');
 if(pendingExpenses)notices.push('รายจ่าย '+pendingExpenses+' รายการยังรอจ่ายหรือรอตรวจสอบ จึงยังไม่รวมในยอด');
 if(expenses.undatedCount)notices.push('ค่าคอมเก่า '+expenses.undatedCount+' รายการไม่ทราบวันที่จ่าย ยังจัดเข้างวดไม่ได้');
 if(sales.waitingCodCount)notices.push('COD '+sales.waitingCodCount+' ออเดอร์รอรับเงิน '+(sales.waitingCodSatang/100).toFixed(2)+' บาท ยังไม่รวมเป็นยอดขาย');
 return {...summary,journal:accountingJournal(sales.summary.rows,summary.entries),sources:sales.sources,notices,missingCosts,waitingCodSatang:sales.waitingCodSatang,pendingCommissionSatang:sales.summary.pendingCommissionSatang};
}
