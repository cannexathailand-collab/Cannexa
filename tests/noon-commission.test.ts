import {test} from 'node:test';import assert from 'node:assert/strict';import {noonCommissionWindow} from '../src/lib/noon-commission';
test('noon cycle stays within the latest Bangkok noon and resets exactly at noon',()=>{
 const before=noonCommissionWindow(new Date('2026-11-07T04:59:59.999Z'));assert.equal(before.start.toISOString(),'2026-11-06T05:00:00.000Z');assert.equal(before.end.toISOString(),'2026-11-07T05:00:00.000Z');
 const at=noonCommissionWindow(new Date('2026-11-07T05:00:00Z'));assert.equal(at.start.toISOString(),'2026-11-07T05:00:00.000Z');assert.equal(at.end.toISOString(),'2026-11-08T05:00:00.000Z');
 assert.equal(+at.end-+at.start,86400000);
});
test('configured employee commission window follows the shared cutoff',()=>{
 const before=noonCommissionWindow(new Date('2026-12-31T07:29:59Z'),870);
 const after=noonCommissionWindow(new Date('2026-12-31T07:30:00Z'),870);
 assert.equal(before.end.toISOString(),'2026-12-31T07:30:00.000Z');
 assert.equal(after.start.toISOString(),'2026-12-31T07:30:00.000Z');
});
