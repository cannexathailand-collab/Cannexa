import {test} from 'node:test';
import assert from 'node:assert/strict';
import {oaProduct} from '../src/lib/line-oa-job';
import {oaCardDescription} from '../src/lib/line-oa-manager';

test('optional card prices retain satang precision and reject invalid amounts',()=>{
 const product={code:'TSTNEW01',name:'Test cup',keyword:'TSTNEW01',replyTitle:'ข้อมูล TSTNEW01',images:[1,2,3].map(slot=>({slot,url:'/test.png'}))};
 assert.equal(oaProduct.parse({...product,priceSatang:9900}).priceSatang,9900);
 assert.equal(oaCardDescription({priceSatang:9900}),'ราคา 99 บาท');
 assert.equal(oaCardDescription({priceSatang:9950}),'ราคา 99.50 บาท');
 assert.equal(oaCardDescription({priceSatang:0}),'ราคา 0 บาท');
 assert.equal(oaCardDescription({}),'ดูรายละเอียดสินค้า');
 for(const priceSatang of [-1,0.1,Infinity,1000000000])assert.equal(oaProduct.safeParse({...product,priceSatang}).success,false);
});
