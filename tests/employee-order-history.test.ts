import {test} from 'node:test';
import assert from 'node:assert/strict';
import {employeeOrderRange,employeeOrderScope,employeeHistoryPage} from '../src/lib/employee-order-history';

test('all-system and personal histories span every round while default keeps the current round',()=>{
 assert.equal(employeeOrderRange({}),'round');
 assert.equal(employeeOrderRange({range:'all'}),'all');
 assert.equal(employeeOrderRange({scope:'mine'}),'all');
 assert.equal(employeeOrderScope({scope:'mine'}),'mine');
});

test('free search crosses personal scope and round selection',()=>{
 assert.equal(employeeOrderRange({q:' TRACKING ',range:'round'}),'all');
 assert.equal(employeeOrderScope({q:'TRACKING',scope:'mine'}),'all');
 assert.equal(employeeOrderScope({q:'   ',scope:'mine'}),'mine');
});

test('history pages contain every status including closed orders and paginate after filtering',()=>{
 const rows=Array.from({length:60},(_,id)=>({id,state:id<30?'SHIPPED':'CANCELLED',shipped:id<30,awaitingShipment:false}));
 const all=employeeHistoryPage(rows,'ALL','3');
 assert.equal(all.count,60);assert.equal(all.pages,3);assert.equal(all.rows.length,10);
 assert.equal(all.rows[0].id,50);
 const shipped=employeeHistoryPage(rows,'SHIPPED','2');
 assert.equal(shipped.count,30);assert.equal(shipped.rows.length,5);assert.equal(shipped.rows[0].id,25);
 const cancelled=employeeHistoryPage(rows,'CANCELLED','999');
 assert.equal(cancelled.page,2);assert.equal(cancelled.rows[0].id,55);
});
