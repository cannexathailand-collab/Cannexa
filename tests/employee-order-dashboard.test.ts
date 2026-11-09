import {test} from 'node:test';
import assert from 'node:assert/strict';
import {employeeSalesWeekStart} from '../src/lib/employee-order-dashboard';
import {orderRoundClosingDay} from '../src/lib/order-round';
test('employee weekly orders start on Monday of the closing-round week',()=>{
 assert.equal(employeeSalesWeekStart('2026-11-09'),'2026-11-09');
 assert.equal(employeeSalesWeekStart('2026-11-15'),'2026-11-09');
 assert.equal(employeeSalesWeekStart('2026-11-16'),'2026-11-16');
});
test('Sunday noon starts the Monday closing round and new employee week',()=>{
 assert.equal(employeeSalesWeekStart(orderRoundClosingDay(new Date('2026-11-08T11:59:59+07:00'),720)),'2026-11-02');
 assert.equal(employeeSalesWeekStart(orderRoundClosingDay(new Date('2026-11-08T12:00:00+07:00'),720)),'2026-11-09');
});
test('year-end closing round belongs to the month and year of its noon close',()=>{
 assert.equal(orderRoundClosingDay(new Date('2026-12-31T11:59:59+07:00'),720),'2026-12-31');
 assert.equal(orderRoundClosingDay(new Date('2026-12-31T12:00:00+07:00'),720),'2027-01-01');
 assert.equal(employeeSalesWeekStart('2027-01-01'),'2026-12-28');
});
