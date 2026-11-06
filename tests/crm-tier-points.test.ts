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
test('promotion threshold, percentage rounding and highest bonus apply on top of frozen normal points',()=>{
 const p={id:'promo',name:'Bonus',minimumSatang:300000,bonusType:'PERCENT',bonusValue:70};
 const saved={version:1,tier:'gold',pointsPerThousand:10,ruleId:'old',enabled:true,promotions:[p]};
 assert.equal(snapshotPoints(saved,300000),51);
 assert.equal(snapshotPoints(saved,299999),29);
 assert.equal(snapshotPoints(saved,310000),52);
 assert.equal(snapshotPoints({...saved,promotions:[p,{...p,id:'fixed',bonusType:'POINTS',bonusValue:25}]},300000),55);
 assert.equal(snapshotPoints({...saved,enabled:false},300000),0);
 assert.equal(snapshotPoints({...saved,promotions:[]},300000),30);
});
