import {test} from 'node:test';
import assert from 'node:assert/strict';
import {estimatedOrderCosts,stockCostExpenses} from '../src/lib/stock-cost-expenses';
const date=new Date('2026-11-09T00:00:00+07:00');
const order={id:'order',orderNumber:'ORDER',status:'WAITING_SHIPMENT',rawText:'รายการสินค้า\nA1 x 10 G'};
const dates=new Map([['order',date]]),costs=new Map([['A1',1250]]);
test('accepted orders contribute estimated cost before dispatch and edits update the estimate',()=>{
 const initial=estimatedOrderCosts([order],new Set(),costs,dates);
 assert.equal(initial.entries[0].amountSatang,12500);assert.equal(initial.entries[0].date,date);assert.equal(initial.entries[0].estimated,true);
 assert.equal(estimatedOrderCosts([{...order,rawText:'รายการสินค้า\nA1 x 20 G'}],new Set(),costs,dates).entries[0].amountSatang,25000);
});
test('cancelled orders remove estimates and posted costs replace rather than duplicate them',()=>{
 assert.equal(estimatedOrderCosts([{...order,status:'CANCELLED'}],new Set(),costs,dates).entries.length,0);
 const estimated=estimatedOrderCosts([order],new Set(['order']),costs,dates);
 const actual=stockCostExpenses([{id:'dispatch',orderId:'order',orderNumber:'ORDER',tracking:'TRACK',status:'POSTED',dispatchedAt:date,items:[{code:'A1',quantityMilliG:10000,costSatang:12000}]}],dates);
 assert.equal(estimated.entries.length,0);assert.equal(actual.length,1);assert.equal(actual[0].amountSatang,12000);
});
test('unknown cost remains missing rather than being counted as zero',()=>{
 const result=estimatedOrderCosts([order],new Set(),new Map(),dates);
 assert.equal(result.entries.length,0);assert.deepEqual(result.missingOrderIds,['order']);
});
test('product cost display combines a day while keeping original entries and credits',async()=>{
 const {groupProductCostExpenses}=await import('../src/lib/stock-cost-expenses');
 const base={kind:'PRODUCT_COST' as const,date,recipient:null,bankName:null,bankAccount:null};
 const entries=[{...base,id:'a',description:'ต้นทุน A',amountSatang:10000},{...base,id:'b',description:'ต้นทุน B',amountSatang:5000,estimated:true},{...base,id:'credit',description:'คืนต้นทุน',amountSatang:-2000},{...base,id:'other',kind:'LINE' as const,description:'รายจ่ายอื่น',amountSatang:300}];
 const grouped=groupProductCostExpenses(entries);assert.equal(grouped.length,2);const cost=grouped.find(row=>row.kind==='PRODUCT_COST')!;assert.equal(cost.amountSatang,13000);assert.equal(cost.details?.length,3);assert.equal(cost.estimated,true);assert.equal(entries.length,4);assert.equal(grouped.reduce((sum,row)=>sum+row.amountSatang,0),13300);
});

test('daily expense groups combine each category without losing amounts or source records',async()=>{
 const {groupExpensesByDay}=await import('../src/lib/stock-cost-expenses');
 const base={date,recipient:null,bankName:null,bankAccount:null};
 const entries=[
  {...base,id:'line-a',kind:'LINE' as const,description:'ค่าไฟ',amountSatang:10000,rawText:'หลักฐานเดิม'},
  {...base,id:'line-b',kind:'LINE' as const,description:'ค่าน้ำมัน',amountSatang:5000},
  {...base,id:'freight',kind:'FREIGHT' as const,description:'ค่าส่ง',amountSatang:2000,tracking:'TRACK'},
  {...base,id:'next-day',kind:'LINE' as const,date:new Date(+date+86400000),description:'ค่าไฟ',amountSatang:3000},
 ];
 const groups=groupExpensesByDay(entries);
 assert.equal(groups.length,3);
 const line=groups.find(group=>group.details?.some(entry=>entry.id==='line-a'))!;
 assert.equal(line.amountSatang,15000);
 assert.equal(line.details?.length,2);
 assert.equal(line.details?.[0].rawText,'หลักฐานเดิม');
 assert.equal(groups.find(group=>group.kind==='FREIGHT')?.details?.[0].tracking,'TRACK');
 assert.equal(groups.reduce((sum,group)=>sum+group.amountSatang,0),20000);
 assert.equal(groups.flatMap(group=>group.details??[]).length,entries.length);
 assert.equal(entries.length,4);
});
