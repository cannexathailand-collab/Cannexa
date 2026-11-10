import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inclusiveTaxTotals,validThaiTaxId,taxBuyerSchema} from '../src/lib/tax-invoice-values';

test('inclusive VAT preserves gross and handles mixed tax treatments',()=>{
 const lines=[
  {description:'สินค้า',quantity:'1',grossSatang:10700,treatment:'STANDARD' as const},
  {description:'อัตราศูนย์',quantity:'1',grossSatang:10000,treatment:'ZERO' as const},
  {description:'ยกเว้น',quantity:'1',grossSatang:2000,treatment:'EXEMPT' as const},
 ];
 const result=inclusiveTaxTotals(lines,700);
 assert.equal(result.vatSatang,700);
 assert.equal(result.netSatang,22000);
 assert.equal(result.totalSatang,22700);
 assert.equal(result.lines[0].netSatang,10000);
});

test('VAT rounds each line to satang without floating-point loss',()=>{
 const result=inclusiveTaxTotals([{description:'สินค้า',quantity:'1',grossSatang:8,treatment:'STANDARD'}],700);
 assert.equal(result.vatSatang,1);
 assert.equal(result.netSatang+result.vatSatang,8);
 assert.throws(()=>inclusiveTaxTotals([{description:'สินค้า',quantity:'1',grossSatang:-1,treatment:'STANDARD'}],700));
});

test('taxpayer ID validation rejects incomplete and invalid checksums',()=>{
 assert.equal(validThaiTaxId('0105556000007'),false);
 assert.equal(validThaiTaxId('123'),false);
 const first='010555600001';
 const sum=[...first].reduce((total,digit,index)=>total+Number(digit)*(13-index),0);
 const valid=first+String((11-sum%11)%10);
 assert.equal(validThaiTaxId(valid),true);
 assert.equal(taxBuyerSchema.safeParse({name:'ผู้ซื้อ',address:'กรุงเทพ',taxId:'',branchCode:'00000',vatRegistered:true}).success,false);
});
