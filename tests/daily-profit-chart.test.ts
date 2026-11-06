import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DailyProfitChart} from '../src/app/daily-profit-chart';
test('daily profit chart preserves gains, losses, zero days and daily totals',()=>{
 const html=renderToStaticMarkup(createElement(DailyProfitChart,{days:[{day:'2026-11-01',profitSatang:10000},{day:'2026-11-02',profitSatang:-3000},{day:'2026-11-03',profitSatang:0}],pending:true}));
 assert.ok(html.includes('#e3f4e9'));assert.ok(html.includes('#fce8e8'));assert.ok(html.includes('#f0f3f2'));
 assert.ok(html.includes('70.00'));assert.ok(html.includes('2026-11-02'));assert.ok(html.includes('เบื้องต้น'));assert.ok(!/NaN|Infinity/.test(html));
});
test('empty and zero-only profit charts have finite geometry',()=>{
 for(const days of [[],[{day:'2026-11-01',profitSatang:0}]])assert.ok(!/NaN|Infinity/.test(renderToStaticMarkup(createElement(DailyProfitChart,{days}))));
});
