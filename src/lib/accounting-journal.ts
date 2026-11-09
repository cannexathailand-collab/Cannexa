import type {SaleRow,IncomeRow} from './sales-report';
import type {ExpenseEntry} from './expense-report';
export type JournalRow={id:string;date:Date;description:string;incomeSatang:number;expenseSatang:number;balanceSatang:number;kind?:'INCOME'|ExpenseEntry['kind']};
export function accountingJournal(income:Array<SaleRow|IncomeRow>,expenses:ExpenseEntry[]):JournalRow[]{
 const receipts=income.flatMap(row=>{
  if('method' in row)return [{id:'income:'+row.id,date:row.date,description:(row.method==='COD'?'รับเงิน COD':'รายรับโอน')+' · '+(row.orderNumber??'รอจับคู่ออเดอร์')+(row.tracking?' · '+row.tracking:''),incomeSatang:row.amountSatang,expenseSatang:0,kind:'INCOME' as const}];
  return row.recognizedAt?[{id:'income:'+row.id,date:row.recognizedAt,description:'ยอดขาย '+(row.paymentMethod==='COD'?'COD':'โอน')+' · '+(row.order?.orderNumber??''),incomeSatang:row.revenueSatang,expenseSatang:0,kind:'INCOME' as const}]:[];
 });
 const rows=[...receipts,...expenses.map(entry=>({id:'expense:'+entry.kind+':'+entry.id,date:entry.date,description:entry.description,incomeSatang:0,expenseSatang:entry.amountSatang,kind:entry.kind}))].sort((a,b)=>+a.date-+b.date||a.id.localeCompare(b.id));
 let balance=0;return rows.map(row=>({...row,balanceSatang:balance+=row.incomeSatang-row.expenseSatang}));
}
