import {test} from 'node:test';
import assert from 'node:assert/strict';
import {phoneShipmentCandidates} from '../src/lib/shipment-matching';
const order={id:'one',affiliateId:'seller',recipient:'Old name',phone:'0812345678 / 0898765432',address:'Old address',rawText:'ยอดรวม: 100',payment:'COD'};
test('phone matching ignores changed name/address and supports either contact phone',()=>{
 for(const phone of ['0812345678','+66 89 876 5432'])assert.equal(phoneShipmentCandidates({recipient:'Other name',address:'Other address',phone,codSatang:20000},[order]).length,1);
 assert.equal(phoneShipmentCandidates({recipient:'Old name',address:'Old address',phone:'0822222222',codSatang:10000},[order]).length,0);
});
test('phone matching exposes multiple candidates and does not cross payment types',()=>{
 const shipment={recipient:'',address:'',phone:'0812345678',codSatang:10000};
 assert.equal(phoneShipmentCandidates(shipment,[order,{...order,id:'two'}]).length,2);
 assert.equal(phoneShipmentCandidates({...shipment,codSatang:0},[order]).length,0);
 assert.equal(phoneShipmentCandidates({...shipment,codSatang:0},[{...order,payment:'โอน'}]).length,1);
});
test('amount resolves a duplicated phone only when it selects the matching order',()=>{
 const shipment={recipient:'',address:'',phone:'0812345678',codSatang:20000};
 const other={...order,id:'two',rawText:'ยอดรวม: 200'};
 assert.deepEqual(phoneShipmentCandidates(shipment,[order,other]).map(o=>o.id),['two']);
});
