import assert from 'node:assert/strict';
import {test} from 'node:test';
import {portalProfile,portalToken,readPortalToken} from '../src/lib/customer-portal';
import {signToken} from '../src/lib/crypto';
process.env.SESSION_SECRET||='customer-portal-unit-test-only';
test('customer sessions reject wrong purpose, expired tokens, tampering and invalid keys',()=>{
 const key='a'.repeat(64),token=portalToken(key);
 assert.equal(readPortalToken(token),key);
 assert.equal(readPortalToken(token+'x'),null);
 assert.equal(readPortalToken(signToken({purpose:'admin',key,exp:Date.now()+50000})),null);
 assert.equal(readPortalToken(signToken({purpose:'CUSTOMER_PORTAL',key,exp:Date.now()-1})),null);
 assert.equal(readPortalToken(signToken({purpose:'CUSTOMER_PORTAL',key:'C0001',exp:Date.now()+50000})),null);
});
test('customer profile accepts two normalized phones and refuses incomplete data',()=>{
 assert.deepEqual(portalProfile({name:' Example Customer ',phone:'+66 81 234 5678 / 0898765432',address:' 12 Bangkok 10200 '}),{name:'Example Customer',phone:'0812345678 / 0898765432',address:'12 Bangkok 10200'});
 for(const input of [{name:'',phone:'0812345678',address:'12 Bangkok 10200'},{name:'Name',phone:'081234567',address:'12 Bangkok 10200'},{name:'Name',phone:'0812345678',address:'12 Bangkok 1020'}])assert.throws(()=>portalProfile(input));
});

test('separate registration address fields preserve postcode validation',()=>{
 const input={name:'Example',phone:'0812345678',houseNumber:'12',road:'Main',subdistrict:'Subdistrict',district:'District',province:'Bangkok',postalCode:'10200'};
 assert.equal(portalProfile(input).address,'12 ถนน Main ตำบล/แขวง Subdistrict อำเภอ/เขต District จังหวัด Bangkok 10200');
 assert.throws(()=>portalProfile({...input,postalCode:'1020'}));
 assert.throws(()=>portalProfile({...input,district:''}));
});