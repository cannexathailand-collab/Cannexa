import assert from 'node:assert/strict';
import {test} from 'node:test';
import {purchasePoints} from '../src/lib/crm-points';
test('points use the rule at purchase time, round each order down and never backfill before activation',()=>{
 const rules=[{enabled:true,satangPerPoint:10000,effectiveAt:new Date('2026-11-01')},{enabled:true,satangPerPoint:20000,effectiveAt:new Date('2026-11-05')},{enabled:false,satangPerPoint:20000,effectiveAt:new Date('2026-11-08')}];
 assert.equal(purchasePoints(35000,new Date('2026-10-31'),rules),0);
 assert.equal(purchasePoints(35000,new Date('2026-11-02'),rules),3);
 assert.equal(purchasePoints(35000,new Date('2026-11-06'),rules),1);
 assert.equal(purchasePoints(35000,new Date('2026-11-09'),rules),0);
 assert.equal(purchasePoints(-1,new Date('2026-11-02'),rules),0);
});
