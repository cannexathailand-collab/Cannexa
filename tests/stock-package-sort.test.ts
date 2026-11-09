import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sortStockPackages} from '../src/lib/stock-price-columns';
test('stock price sizes sort by grams across G and KG labels',()=>{
 assert.deepEqual(sortStockPackages(['10G','50G','100G','1 KG','20G']),['10G','20G','50G','100G','1 KG']);
 assert.deepEqual(sortStockPackages(['1KG','500G','0.25 KG','20 กรัม']),['20 กรัม','0.25 KG','500G','1KG']);
});
test('unrecognized legacy package labels remain visible after known sizes',()=>{
 assert.deepEqual(sortStockPackages(['ชุดพิเศษ','50G','10G']),['10G','50G','ชุดพิเศษ']);
});
