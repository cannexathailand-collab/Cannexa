import assert from 'node:assert/strict';
import {test} from 'node:test';
import {portalProfile,portalToken,readPortalToken,readPortalMarketingEntry,portalPasswordToken,portalPasswordVersion} from '../src/lib/customer-portal';
import {readToken,signToken} from '../src/lib/crypto';
process.env.SESSION_SECRET||='customer-portal-unit-test-only';

test('only a valid signed marketing entry skips the initial contact step',()=>{
 const key='a'.repeat(64);
 assert.equal(readPortalMarketingEntry(portalToken(key)),false);
 assert.equal(readPortalMarketingEntry(portalToken(key,'marketing')),true);
 assert.equal(readPortalMarketingEntry(portalToken(key,'marketing')+'x'),false);
 assert.equal(readPortalMarketingEntry(signToken({purpose:'CUSTOMER_PORTAL',key,marketingEntry:true,exp:Date.now()-1})),false);
 assert.equal(readPortalMarketingEntry(signToken({purpose:'admin',key,marketingEntry:true,exp:Date.now()+60000})),false);
});
test('customer sessions reject wrong purpose, expired tokens, tampering and invalid keys',()=>{
 const key='a'.repeat(64),token=portalToken(key);
 assert.equal(readPortalToken(token),key);
 assert.equal(readPortalToken(token+'x'),null);
 assert.equal(readPortalToken(signToken({purpose:'admin',key,exp:Date.now()+50000})),null);
 assert.equal(readPortalToken(signToken({purpose:'CUSTOMER_PORTAL',key,exp:Date.now()-1})),null);
 assert.equal(readPortalToken(signToken({purpose:'CUSTOMER_PORTAL',key:'C0001',exp:Date.now()+50000})),null);
});
test('password sessions carry a credential version without granting LINE proof',()=>{
 const customer={code:'CUS-00000001',portalPasswordSalt:'test-salt',portalPasswordHash:'test-hash'};
 const token=portalPasswordToken(customer);
 const claims=readToken<Record<string,unknown>>(token)!;
 assert.equal(claims.purpose,'CUSTOMER_PASSWORD_SESSION');
 assert.equal(claims.code,customer.code);
 assert.equal(claims.version,portalPasswordVersion(customer));
 assert.equal(readPortalToken(token),null);
 assert.ok(!('key' in claims));
 assert.ok(!('portalPasswordSalt' in claims));
 assert.ok(!('portalPasswordHash' in claims));
 assert.notEqual(portalPasswordVersion(customer),portalPasswordVersion({...customer,portalPasswordHash:'changed-hash'}));
 assert.notEqual(portalPasswordVersion(customer),portalPasswordVersion({...customer,portalPasswordSalt:'changed-salt'}));
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
