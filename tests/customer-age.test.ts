import assert from 'node:assert/strict';
import {test} from 'node:test';
import {customerAgeDuration, customerAgeToken, readCustomerAgeToken} from '../src/lib/customer-age';
import {signToken} from '../src/lib/crypto';
import {readPortalToken} from '../src/lib/customer-portal';

process.env.SESSION_SECRET ||= 'customer-age-unit-test-only';

test('age challenges bind a verified LINE identity and do not grant a portal session', () => {
  const key = 'a'.repeat(64);
  const before = Date.now();
  const token = customerAgeToken(key, 'marketing-click', 'existing-conversion');
  const claims = readCustomerAgeToken(token)!;

  assert.equal(claims.key, key);
  assert.equal(claims.clickId, 'marketing-click');
  assert.equal(claims.conversionId, 'existing-conversion');
  assert.equal(claims.lineVerified, true);
  assert.equal(claims.friendVerified, undefined);
  assert.ok(claims.exp >= before + customerAgeDuration * 1000);
  assert.ok(claims.exp <= Date.now() + customerAgeDuration * 1000);
  assert.equal(readPortalToken(token), null);
});

test('age challenges reject tampering, expiry, missing LINE identity proof and invalid identity', () => {
  const claims = {
    purpose: 'CUSTOMER_MARKETING_AGE',
    key: 'a'.repeat(64),
    clickId: 'marketing-click',
    conversionId: 'existing-conversion',
    lineVerified: true,
    exp: Date.now() + 600000,
  };

  assert.equal(readCustomerAgeToken(signToken(claims) + 'x'), null);
  for (const change of [
    {purpose: 'CUSTOMER_PORTAL'},
    {exp: Date.now() - 1},
    {lineVerified: false},
    {lineVerified: undefined},
    {key: 'another-customer'},
    {clickId: ''},
    {conversionId: '../another-conversion'},
  ]) {
    assert.equal(readCustomerAgeToken(signToken({...claims, ...change})), null);
  }
});

test('previously issued verified-friend age challenges remain valid',()=>{
 const token=signToken({purpose:'CUSTOMER_MARKETING_AGE',key:'a'.repeat(64),clickId:'click',conversionId:'conversion',friendVerified:true,exp:Date.now()+60000});
 assert.ok(readCustomerAgeToken(token));
});
