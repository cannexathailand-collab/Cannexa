import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {recordSpecialCommission} from '../src/lib/special-commission';
test('special payment rejects unconfirmed, invalid amounts, blank reasons and future dates before persistence',async()=>{
 const input={affiliateId:'test',requestKey:randomUUID(),amountSatang:10000,reason:'Bonus',day:'2026-01-01',confirmed:true};
 for(const change of [{confirmed:false},{amountSatang:0},{amountSatang:-100},{amountSatang:1.5},{amountSatang:2147483648},{reason:' '},{day:'2099-01-01'},{day:'2026-02-30'}])await assert.rejects(()=>recordSpecialCommission('test',{...input,...change}));
});
