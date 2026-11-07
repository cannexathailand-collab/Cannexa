import test from 'node:test';import assert from 'node:assert/strict';
import {contactPhones,validContactPhones} from '../src/lib/contact-phones';
import {analyzeOrderDraft,emptyOrderDraft,orderDraftIssues,renderOrderDraft,defaultOrderTemplate} from '../src/lib/order-draft';
import {parseOrderText} from '../src/lib/order-parser';
import {orderRejectionReasons} from '../src/lib/order-validation';
import {shipmentCandidates} from '../src/lib/shipment-matching';
import {validCustomerPhone} from '../src/lib/draft-customer-identity';

test('two phones are recognized with spaces, newlines, separators, Or and international formatting',()=>{
 for(const separator of [' / ',' ','\n',', ','; ',' | ',' Or ',' หรือ ']){
  assert.deepEqual(contactPhones('0812345678'+separator+'0898765432'),['0812345678','0898765432']);
  assert.deepEqual(validContactPhones('+66 81 234 5678'+separator+'089-876-5432'),['0812345678','0898765432']);
  const parsed=analyzeOrderDraft('Sample Person\n'+('0812345678'+separator+'0898765432')+'\n12 Bangkok 10200\nCG2 10g\nCod 480');
  assert.equal(parsed.fields.phone,'0812345678 / 0898765432',separator);assert.equal(parsed.fields.recipient,'Sample Person',separator);
 }
 assert.deepEqual(contactPhones('๐๘๑๒๓๔๕๖๗๘ / 0898765432'),['0812345678','0898765432']);
 assert.equal(validContactPhones('0812345678 / 089876543'),null);
 assert.equal(validCustomerPhone('0812345678 0898765432'),'0812345678 / 0898765432');
});
test('the complete copied form preserves both phones and the bot accepts both',()=>{
 const draft={...emptyOrderDraft,seller:'seller',recipient:'Sample',phone:'0812345678 / 0898765432',address:'Bangkok 10200',products:'CG2 10g',payment:'COD',amount:'480',customerCode:'C0001'};
 assert.deepEqual(orderDraftIssues(draft),[]);
 const text=renderOrderDraft(defaultOrderTemplate,draft),parsed=parseOrderText(text)!;
 assert.equal(parsed.phone,draft.phone);assert.deepEqual(orderRejectionReasons(parsed),[]);
 assert.ok(orderRejectionReasons({...parsed,phone:'0812345678 / 089876543'}).includes('เบอร์โทรไม่ครบ 10 หลัก'));
});
test('a shipment can match either supplied phone while recipient address and total remain required',()=>{
 const order={id:'o',affiliateId:'a',recipient:'Sample',phone:'0812345678 / 0898765432',address:'Bangkok 10200',payment:'COD',rawText:'ยอดรวม: 480'};
 for(const phone of ['0812345678','0898765432','+66 89 876 5432'])assert.equal(shipmentCandidates({recipient:'Sample',phone,address:order.address,codSatang:48000},[order]).length,1);
 assert.equal(shipmentCandidates({recipient:'Sample',phone:'0822222222',address:order.address,codSatang:48000},[order]).length,0);
});
