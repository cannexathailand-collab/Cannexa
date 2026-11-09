import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderRoundBounds,orderRoundClosingDay} from '../src/lib/order-round';
import {stockCostExpenses} from '../src/lib/stock-cost-expenses';
import {dayStart} from '../src/lib/sales-dates';

test('orders on each side of closing time belong to their closing-day round',()=>{
 assert.equal(orderRoundClosingDay(new Date('2026-11-08T04:59:59Z'),720),'2026-11-08');
 assert.equal(orderRoundClosingDay(new Date('2026-11-08T05:00:00Z'),720),'2026-11-09');
 const round=orderRoundBounds('2026-11-09',720);
 assert.equal(round.start.toISOString(),'2026-11-08T05:00:00.000Z');
 assert.equal(round.end.toISOString(),'2026-11-09T05:00:00.000Z');
});

test('posted product costs use the original order round even when processed later',()=>{
 const dispatchedAt=new Date('2026-11-10T10:00:00Z');
 const rows=[{id:'one',orderId:'order',orderNumber:'ORD-1',tracking:'TRACK',status:'POSTED',dispatchedAt,items:[{code:'A1',quantityMilliG:1000,costSatang:150}]}];
 const entries=stockCostExpenses(rows,new Map([['order',dayStart('2026-11-08')]]));
 assert.equal(entries[0].date.toISOString(),dayStart('2026-11-08').toISOString());
 assert.equal(entries[0].amountSatang,150);
 assert.equal(rows[0].dispatchedAt,dispatchedAt);
});
