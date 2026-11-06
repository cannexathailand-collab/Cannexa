import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {expenseReport} from '../src/lib/expense-report';
import {stockReturnExpenses} from '../src/lib/stock-cost-expenses';
import {expenseCsv} from '../src/lib/expense-csv';

test('received returns reverse exactly the frozen cost in the receipt month and retain original dispatch expense',async t=>{
 const dispatchedAt=new Date('2026-11-06T03:00:00Z'),receivedAt=new Date('2026-12-01T03:00:00Z');
 const items=[{code:'A1',name:'Item',quantityMilliG:200001,unitCostSatang:150,costSatang:30000}];
 const models=[db.expense,db.commission,db.salesOrder,db.shipment,db.recurringExpenseEntry,db.stockDispatch,db.stockReturn,db.additionalCommission] as any[];
 for(const model of models){const old=model.findMany;t.after(()=>{model.findMany=old;});model.findMany=async()=>[];}
 db.stockDispatch.findMany=(async()=>[{id:'d1',orderNumber:'ORDER-1',tracking:'TRACK0001',status:'POSTED',dispatchedAt,items}]) as any;
 const returnRow={id:'r1',tracking:'TRACK0001',status:'POSTED',receivedAt,items,historySnapshot:{orderNumber:'ORDER-1'}};
 db.stockReturn.findMany=(async()=>[returnRow]) as any;
 const before=await expenseReport({from:'2026-11-01',to:'2026-11-30'}),after=await expenseReport({from:'2026-12-01',to:'2026-12-31'});
 assert.equal(before.productCostSatang,30000);assert.equal(after.productCostSatang,-30000);
 assert.equal(before.entries.length,1);assert.equal(after.entries.length,1);assert.equal(after.daily[0].productCostSatang,-30000);
 assert.match(after.entries[0].description,/คืนต้นทุน.*ORDER-1/);assert.match(expenseCsv(after),/-300/);
 assert.equal((await expenseReport({from:'2026-11-01',to:'2026-12-31'})).productCostSatang,0);
 assert.equal(items[0].costSatang,30000);
 assert.deepEqual(stockReturnExpenses([{...returnRow,status:'NEEDS_REVIEW'},{...returnRow,status:'NO_STOCK_CHANGE'}]),[]);
});
