import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cartItemKey, cartQuantityError, readCustomerCart} from '../src/lib/customer-cart';
import type {CustomerCatalogProduct} from '../src/lib/customer-catalog';

const product: CustomerCatalogProduct = {
  code: 'A1', name: 'Product', available: 12, imageVersion: null,
  prices: [{pack: '1G', grams: 1, priceSatang: 100}, {pack: '5G', grams: 5, priceSatang: 400}],
};

test('stored carts reject malformed entries and combine duplicate variants', () => {
  assert.deepEqual(readCustomerCart('not json'), []);
  assert.deepEqual(readCustomerCart('{}'), []);
  assert.deepEqual(readCustomerCart(JSON.stringify([
    {code: 'A1', pack: '1G', quantity: 1},
    {code: 'A1', pack: '1G', quantity: 2},
    {code: 'A1', pack: '5G', quantity: -1},
    {code: 'A1', pack: '5G', quantity: 1.5},
    {code: '', pack: '5G', quantity: 1},
    null,
  ])), [{code: 'A1', pack: '1G', quantity: 3}]);
  assert.notEqual(cartItemKey({code: 'A1', pack: '1G'}), cartItemKey({code: 'A1', pack: '5G'}));
});

test('cart availability counts all package sizes for the same product', () => {
  const items = [{code: 'A1', pack: '5G', quantity: 2}, {code: 'OTHER', pack: '5G', quantity: 99}];
  assert.equal(cartQuantityError(items, product, product.prices[0], 2), null);
  assert.ok(cartQuantityError(items, product, product.prices[0], 3));
  assert.equal(cartQuantityError(items, product, product.prices[1], 2), null);
  assert.ok(cartQuantityError([], product, product.prices[0], 0));
  assert.ok(cartQuantityError([], product, product.prices[0], 1.2));
});

test('unknown stock, unpriced variants and unsafe totals cannot be added', () => {
  assert.ok(cartQuantityError([], {...product, available: null}, product.prices[0], 1));
  assert.ok(cartQuantityError([], {...product, available: 0}, product.prices[0], 1));
  assert.ok(cartQuantityError([], product, {...product.prices[0], priceSatang: 0}, 1));
  assert.ok(cartQuantityError([], product, {...product.prices[0], priceSatang: Number.MAX_SAFE_INTEGER}, 2));
});

test('fractional package quantities compare stock in integer milligrams', () => {
  const price = {pack: '0.1G', grams: 0.1, priceSatang: 100};
  assert.equal(cartQuantityError([], {...product, available: 0.3}, price, 3), null);
  assert.ok(cartQuantityError([], {...product, available: 0.3}, price, 4));
});
