import type {SaleRow} from './sales-report';import type {ExpenseEntry} from './expense-report';
export type JournalRow={id:string;date:Date;description:string;incomeSatang:number;expenseSatang:number;balanceSatang:number};
export function accountingJournal(sales:SaleRow[],expenses:ExpenseEntry[]):JournalRow[]{
 const rows=[...sales.filter(s=>s.recognizedAt).map(s=>({id:'income:'+s.id,date:s.recognizedAt!,description:'ยอดขาย '+(s.paymentMethod==='COD'?'COD':'โอน')+' · '+(s.order?.orderNumber??''),incomeSatang:s.revenueSatang,expenseSatang:0})),...expenses.map(e=>({id:'expense:'+e.kind+':'+e.id,date:e.date,description:e.description,incomeSatang:0,expenseSatang:e.amountSatang}))].sort((a,b)=>+a.date-+b.date||a.id.localeCompare(b.id));
 let balance=0;return rows.map(row=>({...row,balanceSatang:balance+=row.incomeSatang-row.expenseSatang}));
}
