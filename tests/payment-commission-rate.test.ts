import {test} from 'node:test';
import assert from 'node:assert/strict';
import {salesCommissionRate,commissionPercentBps} from '../src/lib/sales-commission-rate';
test('old settings retain fallback and explicit zero overrides it',()=>{
 const old={salesCommissionBps:250};assert.equal(salesCommissionRate(old,'COD'),250);assert.equal(salesCommissionRate(old,'โอน'),250);
 const split={...old,salesCommissionCodBps:300,salesCommissionTransferBps:0};assert.equal(salesCommissionRate(split,'COD'),300);assert.equal(salesCommissionRate(split,'โอน'),0);
});
test('percent inputs validate range and precision without silently rounding or clearing existing values',()=>{
 assert.equal(commissionPercentBps(null),undefined);assert.equal(commissionPercentBps('2.75'),275);assert.equal(commissionPercentBps('0'),0);assert.equal(commissionPercentBps('100'),10000);
 for(const input of ['', '-1','100.01','2.555','NaN','Infinity','1e2'])assert.throws(()=>commissionPercentBps(input));
});
