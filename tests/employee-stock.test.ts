import {test} from 'node:test';
import assert from 'node:assert/strict';
import {employeeStockRows} from '../src/lib/employee-stock';
test('employee stock exposes sale information without costs and uses stock availability rules',()=>{
 const rows=employeeStockRows([{code:'CG10',name:'Second',costSatang:987654,receivedQuantity:50,issuedQuantity:10,remainingQuantity:40,completedQuantity:0,precountedPendingQuantity:2,salePrices:[{pack:'10g',priceSatang:50000}],sourceRow:3},{code:'CG2',name:'First',costSatang:123456,receivedQuantity:20,issuedQuantity:3,remainingQuantity:17,completedQuantity:0,unverifiedPendingQuantity:3,salePrices:[],sourceRow:4}]);
 assert.deepEqual(rows.map(p=>p.code),['CG2','CG10']);assert.equal(rows[0].available,null);assert.equal(rows[1].available,12);assert.ok(!JSON.stringify(rows).includes('costSatang'));assert.ok(!JSON.stringify(rows).includes('987654'));assert.equal(rows[1].prices[0].priceSatang,50000);
});
