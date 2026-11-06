import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeEmployeeCommissions,type EmployeeCommission} from '../src/lib/employee-commissions';
test('employee commission cards separate unpaid, paid, waiting, and each commission source',()=>{
 const row=(id:string,kind:EmployeeCommission['kind'],status:EmployeeCommission['status'],amount:number|null):EmployeeCommission=>({id,kind,status,amount,date:new Date(),paidAt:null,reference:id,note:''});
 const summary=summarizeEmployeeCommissions([row('friend','FRIEND','PENDING',100),row('sale','COD','PENDING',300),row('extra','TRANSFER','PAID',200),row('bonus','SPECIAL','PAID',500),row('cod','COD','WAITING',null)]);
 assert.equal(summary.pending,400);assert.equal(summary.paid,700);assert.equal(summary.waiting,1);
 assert.deepEqual(summary.categories.find(r=>r.kind==='COD'),{kind:'COD',pending:300,paid:0,waiting:1,count:2});
 assert.deepEqual(summary.categories.find(r=>r.kind==='SPECIAL'),{kind:'SPECIAL',pending:0,paid:500,waiting:0,count:1});
});
test('empty commission account has four empty categories and no invented amount',()=>{
 const summary=summarizeEmployeeCommissions([]);assert.equal(summary.pending,0);assert.equal(summary.paid,0);assert.equal(summary.waiting,0);assert.equal(summary.categories.length,4);
});
