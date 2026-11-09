import type {SaleRow,IncomeRow} from './sales-report';
import type {ExpenseEntry} from './expense-report';
export type JournalRow={id:string;date:Date;description:string;incomeSatang:number;expenseSatang:number;balanceSatang:number;kind?:'INCOME'|ExpenseEntry['kind'];incomeMethod?:'TRANSFER'|'COD';orderId?:string|null;orderNumber?:string|null;tracking?:string|null};
export function accountingJournal(income:Array<SaleRow|IncomeRow>,expenses:ExpenseEntry[]):JournalRow[]{
 const receipts=income.flatMap(row=>{
  if('method' in row)return [{id:'income:'+row.id,date:row.date,description:(row.method==='COD'?'รับเงิน COD':'รายรับโอน')+' · '+(row.orderNumber??'รอจับคู่ออเดอร์')+(row.tracking?' · '+row.tracking:''),incomeSatang:row.amountSatang,expenseSatang:0,orderId:row.orderId,orderNumber:row.orderNumber,tracking:row.tracking,kind:'INCOME' as const,incomeMethod:row.method}];
  return row.recognizedAt?[{id:'income:'+row.id,date:row.recognizedAt,description:'ยอดขาย '+(row.paymentMethod==='COD'?'COD':'โอน')+' · '+(row.order?.orderNumber??''),incomeSatang:row.revenueSatang,expenseSatang:0,orderId:row.orderId,orderNumber:row.order?.orderNumber??null,tracking:row.tracking,kind:'INCOME' as const,incomeMethod:row.paymentMethod==='COD'?'COD' as const:'TRANSFER' as const}]:[];
 });
 const rows=[...receipts,...expenses.map(entry=>({id:'expense:'+entry.kind+':'+entry.id,date:entry.date,description:entry.description,incomeSatang:0,expenseSatang:entry.amountSatang,kind:entry.kind}))].sort((a,b)=>+a.date-+b.date||a.id.localeCompare(b.id));
 let balance=0;return rows.map(row=>({...row,balanceSatang:balance+=row.incomeSatang-row.expenseSatang}));
}

export function journalGroups(rows:JournalRow[]){
 return [...Map.groupBy(rows,row=>row.kind==='INCOME'?(row.incomeMethod??'INCOME'):(row.kind??'OTHER'))].map(([key,entries])=>({key,entries,incomeSatang:entries.reduce((sum,row)=>sum+row.incomeSatang,0),expenseSatang:entries.reduce((sum,row)=>sum+row.expenseSatang,0)}));
}
