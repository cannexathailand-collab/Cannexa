import assert from 'node:assert/strict';
import {test} from 'node:test';
import {checkoutCartItems, createCustomerCheckout, isDefiniteCheckoutFailure, readCheckoutOrder, readCustomerCheckout} from '../src/lib/customer-checkout';
import type {CustomerCatalogProduct} from '../src/lib/customer-catalog';

const requestKey = '12345678-1234-4234-8234-123456789abc';
const cod={paymentMethod:'COD' as const,bankVersion:null};
const product: CustomerCatalogProduct = {
  code: 'A1', name: 'Product', available: 12, imageVersion: null,
  prices: [{pack: '1G', grams: 1, priceSatang: 100}, {pack: '5G', grams: 5, priceSatang: 400}],
};

test('checkout freezes unit prices and restores all cart lines from its persisted payload', () => {
  const items = [{code: 'A1', pack: '1G', quantity: 2}, {code: 'A1', pack: '5G', quantity: 2}];
  const payload = createCustomerCheckout(items, [product], requestKey,cod);
  assert.equal(payload.expectedTotalSatang, 11000);
  assert.equal(payload.expectedShippingSatang,10000);
  assert.deepEqual(payload.items.map(item => item.expectedUnitPriceSatang), [100, 400]);
  const saved = JSON.stringify(payload);
  const changed = {...product, prices: product.prices.map(price => ({...price, priceSatang: price.priceSatang + 50}))};
  assert.equal(createCustomerCheckout(items, [changed], requestKey,cod).expectedTotalSatang, 11200);
  assert.deepEqual(readCustomerCheckout(saved), payload);
  assert.deepEqual(checkoutCartItems(readCustomerCheckout(saved)!), items);
});

test('checkout rejects invalid stock, missing packages and unsafe totals before sending', () => {
  assert.throws(() => createCustomerCheckout([], [product], requestKey,cod));
  assert.throws(() => createCustomerCheckout([{code: 'A1', pack: '1G', quantity: 3}, {code: 'A1', pack: '5G', quantity: 2}], [product], requestKey,cod));
  assert.throws(() => createCustomerCheckout([{code: 'A1', pack: '10G', quantity: 1}], [product], requestKey,cod));
  assert.throws(() => createCustomerCheckout([{code: 'A1', pack: '1G', quantity: 2}], [{...product, prices: [{pack: '1G', grams: 1, priceSatang: Number.MAX_SAFE_INTEGER}]}], requestKey,cod));
});

test('persisted checkout validation rejects incomplete, inconsistent and duplicate payloads', () => {
  const payload = createCustomerCheckout([{code: 'A1', pack: '1G', quantity: 1}], [product], requestKey,cod);
  assert.equal(readCustomerCheckout(null), null);
  assert.equal(readCustomerCheckout('invalid'), null);
  assert.equal(readCustomerCheckout(JSON.stringify({...payload, requestKey: 'wrong'})), null);
  assert.equal(readCustomerCheckout(JSON.stringify({...payload, expectedTotalSatang: 101})), null);
  assert.equal(readCustomerCheckout(JSON.stringify({...payload, items: [...payload.items, ...payload.items], expectedTotalSatang: 200})), null);
  assert.equal(readCustomerCheckout(JSON.stringify({...payload, items: [{...payload.items[0], quantity: 0}]})), null);
});

test('confirmation requires a real order summary before checkout can be cleared', () => {
  const order = {id: 'order-1', orderNumber: 'WEB-1', status: 'PENDING_REVIEW', totalSatang: 100};
  assert.deepEqual(readCheckoutOrder(order), order);
  assert.equal(readCheckoutOrder({ok: true}), null);
  assert.equal(readCheckoutOrder({...order, id: ''}), null);
  assert.equal(readCheckoutOrder({...order, totalSatang: -1}), null);
});

test('only definite validation failures release a frozen checkout request', () => {
  for (const code of ['PRICE_CHANGED', 'STOCK_CHANGED', 'PRODUCT_UNAVAILABLE', 'TOTAL_CHANGED', 'INVALID_DELIVERY', 'INVALID_WEBSITE_ORDER', 'ORDER_TOO_LARGE','PAYMENT_REQUIRED','INVALID_PAYMENT','SHIPPING_CHANGED','BANK_UNAVAILABLE','BANK_CHANGED','SLIP_REQUIRED','INVALID_SLIP','SLIP_TOO_LARGE']) {
    assert.equal(isDefiniteCheckoutFailure(400, code), true);
    assert.equal(isDefiniteCheckoutFailure(409, code), true);
    assert.equal(isDefiniteCheckoutFailure(503, code), false);
  }
  for (const status of [401, 403, 404, 429, 500]) assert.equal(isDefiniteCheckoutFailure(status, 'UNAUTHORIZED'), false);
  assert.equal(isDefiniteCheckoutFailure(409, 'REQUEST_CONFLICT'), false);
  assert.equal(isDefiniteCheckoutFailure(400, 'UNKNOWN'), false);
  assert.equal(isDefiniteCheckoutFailure(400, undefined), false);
});

test('transfer checkout freezes bank version and slip while legacy pending requests stay readable',()=>{
 const items=[{code:'A1',pack:'1G',quantity:1}],slip='data:image/png;base64,iVBORw0KGgo=';
 const payload=createCustomerCheckout(items,[product],requestKey,{paymentMethod:'TRANSFER',bankVersion:requestKey,slip});
 assert.equal(payload.expectedTotalSatang,5100);assert.equal(payload.expectedShippingSatang,5000);
 assert.equal(payload.bankVersion,requestKey);assert.equal(payload.slip,slip);
 assert.deepEqual(readCustomerCheckout(JSON.stringify(payload)),payload);
 assert.equal(readCustomerCheckout(JSON.stringify({...payload,slip:undefined})),null);
 assert.equal(readCustomerCheckout(JSON.stringify({...payload,bankVersion:null})),null);
 assert.throws(()=>createCustomerCheckout(items,[product],requestKey,undefined as any),/เลือกวิธีชำระเงิน/);
 assert.throws(()=>createCustomerCheckout(items,[product],requestKey,{paymentMethod:'TRANSFER',bankVersion:requestKey}),/แนบสลิป/);
 assert.throws(()=>createCustomerCheckout(items,[product],requestKey,{...cod,slip}));
 const legacy={requestKey,items:[{...items[0],expectedUnitPriceSatang:100}],expectedTotalSatang:100};
 assert.deepEqual(readCustomerCheckout(JSON.stringify(legacy)),legacy);
});
