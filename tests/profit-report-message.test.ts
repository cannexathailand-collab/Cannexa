import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lastClosedProfitRound,profitReportText} from '../src/lib/profit-report-message';
test('reports the last completed daily round before, at, and after cutoff',()=>{
 assert.equal(lastClosedProfitRound(new Date('2026-11-10T04:59:59Z'),720).day,'2026-11-09');
 assert.equal(lastClosedProfitRound(new Date('2026-11-10T05:00:00Z'),720).day,'2026-11-10');
 assert.equal(lastClosedProfitRound(new Date('2026-11-10T05:01:00Z'),720).day,'2026-11-10');
 assert.equal(lastClosedProfitRound(new Date('2026-11-10T17:00:00Z'),0).day,'2026-11-11');
});
test('report names gross profit and exposes estimated or incomplete costs',()=>{
 const summary={count:24,revenueSatang:3057000,transferSatang:1898500,codSatang:1158500,costSatang:1360750,profitSatang:1696250,estimatedCostCount:24,missingCostCount:0};
 const text=profitReportText('2026-11-10','12:00',summary);
 assert.match(text,/ยอดขาย 30,570.00 บาท/);assert.match(text,/ยอดโอน 18,985.00 บาท/);assert.match(text,/ยอด COD 11,585.00 บาท/);assert.match(text,/กำไรขั้นต้น 16,962.50 บาท/);assert.match(text,/ประมาณการก่อนจัดส่ง 24/);
 const missing=profitReportText('2026-11-10','12:00',{...summary,profitSatang:null,missingCostCount:1,unknownAmountCount:2});
 assert.match(missing,/กำไรขั้นต้น รอต้นทุนครบ/);assert.match(missing,/ยอดเงินไม่ครบ 2/);
});
