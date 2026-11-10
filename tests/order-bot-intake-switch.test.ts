import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {z} from 'zod';

function webhook(file:string,receiveOrders:boolean){
 const calls={orders:0,orderReplies:0,expenses:0,expenseReplies:0};
 const connection={active:true,receiveOrders,botId:'bot',encrypted:'encrypted'};
 const settings={botId:'bot',messagingSecret:'secret',accessToken:'token'};
 const mocks:Record<string,unknown>={
  '@/lib/owner-profit-report':{bindProfitReportRecipient:async()=>false},
  'next/server':{after:()=>{}},
  zod:{z},
  '@/lib/db':{db:{orderBot:{findUnique:async()=>connection}}},
  '@/lib/config':{mockMode:()=>false},
  '@/lib/crypto':{validSignature:()=>true,userKey:(value:string)=>value},
  '@/lib/line-settings':{unseal:()=>settings,lineSettings:async()=>({settings})},
  '@/lib/order-intake':{receiveOrderEvent:async()=>{calls.orders++;return {id:'order'};}},
  '@/lib/order-confirmation':{replyOrderConfirmation:async()=>{calls.orderReplies++;}},
  '@/lib/expense-intake':{receiveExpenseEvent:async()=>{calls.expenses++;}},
  '@/lib/expense-confirmation':{replyExpenseConfirmation:async()=>{calls.expenseReplies++;}},
  '@/lib/stock-dispatch':{processPendingStockDispatches:async()=>{}},
  '@/lib/stock-flow':{processPendingReservations:async()=>{},queueStockOrder:async()=>{}},
  '@/lib/tracking':{webhook:async()=>{}},
  '@/lib/customer-code-message':{replyCustomerCode:async()=>{}},
 };
 const exports:Record<string,any>={};
 const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:(name:string)=>{assert.ok(name in mocks,name);return mocks[name];},Response,Buffer,process:{env:{}}});
 return {calls,post:exports.POST};
}
for(const file of ['src/app/api/line/webhook/route.ts','src/app/api/line/orders/[bot]/route.ts']){
 for(const enabled of [false,true]){
  test(`${file} keeps expense intake active with order intake ${enabled?'on':'off'}`,async()=>{
   const {calls,post}=webhook(file,enabled);
   const request=new Request('https://example.test/webhook',{method:'POST',body:JSON.stringify({destination:'bot',events:[{webhookEventId:'event',type:'message',timestamp:1,replyToken:'reply',source:{type:'group',groupId:'group'},message:{type:'text',id:'message',text:'example'}}]})});
   const response=await post(request,{params:Promise.resolve({bot:'bot'})});
   assert.equal(response.status,200);
   assert.equal(calls.orders,enabled?1:0);assert.equal(calls.orderReplies,enabled?1:0);
   assert.equal(calls.expenses,1);assert.equal(calls.expenseReplies,1);
  });
 }
}
