import {test} from 'node:test';import assert from 'node:assert/strict';import {expenseBreakdown} from '../src/lib/expense-breakdown';import {renderToStaticMarkup} from 'react-dom/server';import {createElement} from 'react';import {ExpenseBreakdownChart} from '../src/app/expense-breakdown-chart';
test('chart groups commissions and excludes credits from percent denominator while preserving net total',()=>{
 const data=expenseBreakdown([{kind:'PRODUCT_COST',amountSatang:60000},{kind:'PRODUCT_COST',amountSatang:-10000},{kind:'FREIGHT',amountSatang:20000},{kind:'FRIEND',amountSatang:5000},{kind:'SALE',amountSatang:15000}]);
 assert.equal(data.grossSatang,100000);assert.equal(data.creditsSatang,10000);assert.equal(data.netSatang,90000);assert.deepEqual(data.slices.map(s=>s.percent),[60,20,20]);assert.equal(data.slices.reduce((n,s)=>n+s.percent,0),100);
 const empty=expenseBreakdown([]);assert.equal(empty.grossSatang,0);assert.deepEqual(empty.slices,[]);
 const html=renderToStaticMarkup(createElement(ExpenseBreakdownChart,{entries:[],from:'2026-11-01',to:'2026-11-07'}));assert.ok(html.includes('<svg'));assert.ok(html.includes('กราฟวงแหวน'));assert.ok(!html.includes('NaN'));
});
