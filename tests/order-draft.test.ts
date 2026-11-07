import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultOrderTemplate,emptyOrderDraft,extractOrderDraft,renderOrderDraft,orderDraftIssues,differentDraftAddress,hasCompletePostalCode} from '../src/lib/order-draft';
import {orderTemplateIssues} from '../src/lib/order-templates';
import {parseOrderText} from '../src/lib/order-parser';
import {quotedTotal} from '../src/lib/shipment-matching';
test('draft extracts labelled customer fields and multiline address without confusing product code with customer code',()=>{
 const parsed=extractOrderDraft('ชื่อผู้รับ: ลูกค้าทดสอบ\nเบอร์โทร: ๐๘๑๒๓๔๕๖๗๘\nที่อยู่: 10 ถนนทดสอบ\nกรุงเทพ 10200\nสินค้า: AB1234 20g\nชำระเงิน: COD\nยอดเงิน: 1,260 บาท');
 assert.equal(parsed.address,'10 ถนนทดสอบ\nกรุงเทพ 10200');assert.equal(parsed.phone,'0812345678');assert.equal(parsed.products,'AB1234 20g');assert.equal(parsed.amount,'1260.00');assert.equal(parsed.customerCode,undefined);
 const draft={...emptyOrderDraft,...parsed,seller:'seller'};const text=renderOrderDraft(defaultOrderTemplate,draft);
 assert.deepEqual(orderDraftIssues(draft),[]);assert.equal(parseOrderText(text)?.address,'10 ถนนทดสอบ กรุงเทพ 10200');assert.equal(quotedTotal(text),126000);assert.ok(text.endsWith('รหัสลูกค้า:'));
});
test('draft leaves missing money and payment blank rather than inventing data',()=>{
 const parsed=extractOrderDraft('ลูกค้าทดสอบ\n0812345678');assert.equal(parsed.recipient,'ลูกค้าทดสอบ');assert.equal(parsed.phone,'0812345678');assert.equal(parsed.amount,undefined);assert.equal(parsed.payment,undefined);assert.ok(orderDraftIssues({...emptyOrderDraft,...parsed}).length>0);
});
test('custom templates must preserve fields and an order format accepted by the bot',()=>{
 assert.deepEqual(orderTemplateIssues(defaultOrderTemplate),[]);
 assert.ok(orderTemplateIssues(defaultOrderTemplate.replace('{{เบอร์โทร}}','')).length>0);
 assert.ok(orderTemplateIssues('หัวข้อก่อน\n'+defaultOrderTemplate).length>0);
 assert.ok(orderTemplateIssues(defaultOrderTemplate+'\nยอดรวม: {{ยอดตามข้อความ}}').length>0);
});
test('address comparison ignores formatting and flags a genuinely different destination',()=>{
 assert.equal(differentDraftAddress('10 ต.บางรัก\nจ.กรุงเทพ 10200','10 ตำบลบางรัก จังหวัดกรุงเทพ 10200'),false);
 assert.equal(differentDraftAddress('20 ถนนใหม่ กรุงเทพ 10100','10 ถนนเดิม กรุงเทพ 10200'),true);
 assert.equal(differentDraftAddress('','10 ถนนเดิม'),false);
 const parsed=extractOrderDraft('ลูกค้า\n0812345678\n10 ถนนทดสอบ\nกรุงเทพ 10200\nสินค้า: CG13 20g');assert.equal(parsed.address,'10 ถนนทดสอบ\nกรุงเทพ 10200');
});
test('raw inline shipping contact, unlabelled SKU and COD amount are separated into columns',()=>{
 const parsed=extractOrderDraft('ส่งน.ส.ทดสอบ ใจดี 12/34 ถ.ทดลอง1 ต.ในเมือง อ.เมือง จ.บุรีรัมย์ 31000 โทร0812345678\n\nTM2 50g\n\nCod 350\n\nL. demo999');
 assert.equal(parsed.recipient,'น.ส.ทดสอบ ใจดี');assert.equal(parsed.address,'12/34 ถ.ทดลอง1 ต.ในเมือง อ.เมือง จ.บุรีรัมย์ 31000');assert.equal(parsed.phone,'0812345678');assert.equal(parsed.products,'TM2 50g');assert.equal(parsed.payment,'COD');assert.equal(parsed.amount,'350.00');assert.equal(parsed.customerCode,undefined);
 assert.deepEqual(orderDraftIssues({...emptyOrderDraft,...parsed,seller:'seller'}),[]);
});
test('unlabelled multiline address preceding phone is kept as one address',()=>{
 const parsed=extractOrderDraft('ผู้รับ\nชื่อ : TEST\nตัวอย่างริมน้ำเลข28\nบ้านเกิด9 11000\nเมืองนนทบุรี,นนทบุรี.ไทย\n0812345678\n\nNT16 5g\n\nCod 200\n\nL. demo');
 assert.equal(parsed.recipient,'TEST');assert.equal(parsed.address,'ตัวอย่างริมน้ำเลข28\nบ้านเกิด9 11000\nเมืองนนทบุรี,นนทบุรี.ไทย');assert.equal(parsed.products,'NT16 5g');assert.equal(parsed.amount,'200.00');assert.deepEqual(orderDraftIssues({...emptyOrderDraft,...parsed,seller:'seller'}),[]);
});
test('draft blocks incomplete phone and postcode before customer creation or copying',()=>{
 const draft={...emptyOrderDraft,seller:'seller',recipient:'Name',phone:'081234567',address:'10 Bangkok 1020',products:'TM2 10g',payment:'COD',amount:'100'};
 assert.ok(orderDraftIssues(draft).includes('เบอร์โทรต้องครบ 10 หลัก'));assert.ok(orderDraftIssues(draft).includes('รหัสไปรษณีย์ต้องครบ 5 หลัก'));
 assert.deepEqual(orderDraftIssues({...draft,phone:'+66 81 234 5678',address:'10 Bangkok 10200'}),[]);
 assert.equal(hasCompletePostalCode('เลขที่ 12345 Bangkok รหัสไปรษณีย์ 1020'),false);assert.equal(hasCompletePostalCode('เลขที่ 12345 Bangkok'),false);assert.equal(hasCompletePostalCode('12345 ถนนตัวอย่าง กรุงเทพ 10200'),true);
});
