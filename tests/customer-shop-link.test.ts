import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customerProductPath,customerShopProduct} from '../src/lib/customer-shop-link';

test('product links normalize codes without accepting redirects or path traversal',()=>{
 assert.equal(customerProductPath(' book1 '),'/customer/shop/BOOK1');
 assert.equal(customerShopProduct('ＢＯＯＫ１'),'BOOK1');
 for(const code of ['https://example.com','//evil.test','../BOOK1','BOOK1?customer=another','<script>','',null,undefined,['BOOK1'],'A'.repeat(51)]){
  assert.equal(customerShopProduct(code),null);
  assert.throws(()=>customerProductPath(code),/INVALID_PRODUCT_CODE/);
 }
});
