import assert from 'node:assert/strict';
import {test} from 'node:test';
import {customerDiscoverySource} from '../src/lib/customer-discovery-source';

test('customer discovery source accepts the five channels and keeps legacy input optional',()=>{
 for(const value of ['WEBSITE','LINE','FACEBOOK','INSTAGRAM','OTHER'])assert.equal(customerDiscoverySource(value),value);
 assert.equal(customerDiscoverySource(undefined),undefined);
 assert.equal(customerDiscoverySource(''),null);
 for(const value of ['invalid',null,{},3])assert.throws(()=>customerDiscoverySource(value));
});
