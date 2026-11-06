import assert from 'node:assert/strict';import {test} from 'node:test';
import {pointsPerThousand,snapshotPoints,pointTierKey,tierPointRatesSchema} from '../src/lib/crm-tier-points';
test('per-tier rewards use proportional amounts with whole-point rounding',()=>{
 assert.equal(pointsPerThousand(100000,10),10);assert.equal(pointsPerThousand(100000,20),20);assert.equal(pointsPerThousand(150000,20),30);assert.equal(pointsPerThousand(1000,1),0);
 assert.equal(pointTierKey('VIP Platinum'),'vip');assert.equal(pointTierKey('ยังไม่เข้าเกณฑ์'),'new');
 assert.equal(tierPointRatesSchema.safeParse({new:1,bronze:2,silver:3,gold:4,vip:-1}).success,false);
});
test('stored order snapshots keep their rate and disabled snapshots award nothing',()=>{
 const saved={version:1,tier:'gold',pointsPerThousand:20,ruleId:'old',enabled:true};
 assert.equal(snapshotPoints(saved,100000),20);assert.equal(snapshotPoints({...saved,enabled:false},100000),0);assert.equal(snapshotPoints(null,100000),null);
});
