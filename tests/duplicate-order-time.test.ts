import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DuplicateOrderNotice} from '../src/app/duplicate-order-notice';
test('duplicate warning shows the current order time before opening details and both timestamps inside',()=>{
 const current={orderNumber:'CURRENT',eventAt:new Date('2026-11-09T06:00:00Z'),createdAt:new Date('2026-11-09T06:45:10Z')};
 const other={id:'other',orderNumber:'OTHER',recipient:'Buyer',eventAt:new Date('2026-11-09T07:00:00Z'),createdAt:new Date('2026-11-09T07:00:20Z'),reasons:['same order']};
 const html=renderToStaticMarkup(createElement(DuplicateOrderNotice,{currentOrder:current,matches:[other]}));
 assert.ok(html.includes('13:45:10'));assert.ok(html.includes('14:00:20'));
 assert.ok(html.includes('2026-11-09T06:45:10.000Z'));assert.ok(html.includes('2026-11-09T07:00:20.000Z'));
 assert.ok(html.indexOf('13:45:10')<html.indexOf('<dialog'));
 assert.ok(html.includes('เวลาไทย'));
});
