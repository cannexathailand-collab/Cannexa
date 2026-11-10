import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customerLoginDestination} from '../src/lib/customer-login-intent';
test('ordinary LINE login never forces password setup, while an explicit reset requires an approved member',()=>{
 const ready={portalRegistrationPending:false,portalProfileIncomplete:false};
 assert.equal(customerLoginDestination('CUSTOMER',ready),'/customer');
 assert.equal(customerLoginDestination('CUSTOMER',null),'/customer');
 assert.equal(customerLoginDestination('CUSTOMER_REGISTER',null),'/customer?register=1');
 assert.equal(customerLoginDestination('CUSTOMER_REGISTER',ready),'/customer');
 assert.equal(customerLoginDestination('CUSTOMER_PASSWORD_RESET',ready),'/customer/password?reset=1');
 assert.equal(customerLoginDestination('CUSTOMER_PASSWORD_RESET',{...ready,portalRegistrationPending:true}),'/customer');
 assert.equal(customerLoginDestination('CUSTOMER_PASSWORD_RESET',{...ready,portalProfileIncomplete:true}),'/customer');
 assert.equal(customerLoginDestination('CUSTOMER_PASSWORD_RESET',null),'/customer');
});
