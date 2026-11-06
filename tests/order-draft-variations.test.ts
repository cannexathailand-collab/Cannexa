import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeOrderDraft} from '../src/lib/order-draft-parser';
function shuffled<T>(items:T[],seed:number){const out=[...items];for(let i=out.length-1;i>0;i--){seed=(seed*1664525+1013904223)>>>0;const j=seed%(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;}
test('320 labelled variations cover field order, Thai and English labels, separators, spacing, bullets, currency and phone forms',()=>{
 const thai=['ชื่อผู้รับ','เบอร์โทร','ที่อยู่','สินค้า','ชำระเงิน','ยอดเงิน','รหัสลูกค้า'],english=['recipient','phone','address','items','payment','total','customer code'];
 for(let i=0;i<320;i++){
  const keys=i%2?thai:english,sep=[': ','：',' = ',' - ',' '][i%5],phone=['0812345678','081-234-5678','+66 81 234 5678','+66(0)812345678'][i%4];
  const address=['','บ้านเลขที่ ','เลขที่ '][i%3]+'12/34 ถนนทดลอง\nกรุงเทพ 10200';
  const values=['ทดสอบ ใจดี',phone,address,'TM2 50g',i%2?'โอน':'COD',i%3?'฿1,260.50':'1260.50 บาท','C0001'];
  const lines=keys.map((k,index)=>(i%7===0?'• ':'')+k+sep+values[index]);
  const result=analyzeOrderDraft(shuffled(lines,i+21).join(i%3?'\n':'\r\n\r\n'));
  assert.deepEqual(result.issues,{},'variation '+i);assert.equal(result.fields.recipient,'ทดสอบ ใจดี','name '+i);assert.equal(result.fields.phone,'0812345678','phone '+i);assert.equal(result.fields.address,address,'address '+i);assert.equal(result.fields.products,'TM2 50g','products '+i);assert.equal(result.fields.amount,'1260.50','amount '+i);assert.equal(result.fields.customerCode,'C0001','code '+i);
 }
});
test('120 free-text arrangements identify entities independently of their order',()=>{
 const blocks=['ทดสอบ ใจดี','12/34 ถนนทดลอง\nกรุงเทพ 10200','081-234-5678','NT16 5g','COD 350'];
 for(let i=0;i<120;i++){const result=analyzeOrderDraft(shuffled(blocks,i+55).join('\n\n'));assert.deepEqual(result.issues,{},'raw '+i);assert.equal(result.fields.recipient,'ทดสอบ ใจดี','name '+i);assert.equal(result.fields.address,'12/34 ถนนทดลอง\nกรุงเทพ 10200','address '+i);assert.equal(result.fields.phone,'0812345678','phone '+i);assert.equal(result.fields.products,'NT16 5g','product '+i);assert.equal(result.fields.amount,'350.00','amount '+i);}
});
test('conflicting phones, totals and payment types are flagged instead of guessed',()=>{
 const result=analyzeOrderDraft('เบอร์โทร: 0812345678\nเบอร์โทร: 0898765432\nยอดเงิน: 350\nยอดรวม: 450\nCOD\nโอน');
 assert.ok(result.issues.phone);assert.ok(result.issues.amount);assert.ok(result.issues.payment);assert.equal(result.fields.phone,'');assert.equal(result.fields.amount,'');assert.equal(result.fields.payment,'');
});
test('same phone in Thai and international formats is one value',()=>{
 const result=analyzeOrderDraft('โทร: 0812345678\nโทร: +66812345678');assert.deepEqual(result.issues,{});assert.equal(result.fields.phone,'0812345678');
});
test('standalone labels and multiple product lines preserve every item',()=>{
 const result=analyzeOrderDraft('ผู้รับ\nชื่อ\nทดสอบ ใจดี\nเบอร์โทร\n0812345678\nที่อยู่\n12 ถนนทดลอง\nกรุงเทพ 10200\nสินค้า: TM2 50g\nNT16 5g\nโอนแล้ว 350');
 assert.deepEqual(result.issues,{});assert.equal(result.fields.recipient,'ทดสอบ ใจดี');assert.equal(result.fields.phone,'0812345678');assert.equal(result.fields.address,'12 ถนนทดลอง\nกรุงเทพ 10200');assert.equal(result.fields.products,'TM2 50g\nNT16 5g');assert.equal(result.fields.payment,'โอน');assert.equal(result.fields.amount,'350.00');
});
test('numbered English recipient and address starting with house label are not confused',()=>{
 const result=analyzeOrderDraft('2\nAdam Example-Batal\n+66 81-234-5678\nบ้านเลขที่ 116/10 หมู่ 7 ตำบลทดสอบ อำเภอเมือง จังหวัดลพบุรี 15000 ประเทศไทย\nAF8 10g\nAF2 10g\nโอน 900\nL. Adam Example-Batal');
 assert.deepEqual(result.issues,{});assert.equal(result.fields.recipient,'Adam Example-Batal');assert.ok(result.fields.address?.startsWith('บ้านเลขที่ 116/10'));assert.equal(result.fields.phone,'0812345678');assert.equal(result.fields.products,'AF8 10g\nAF2 10g');assert.equal(result.fields.amount,'900.00');
});
