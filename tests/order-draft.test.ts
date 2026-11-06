import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultOrderTemplate,emptyOrderDraft,extractOrderDraft,renderOrderDraft,orderDraftIssues} from '../src/lib/order-draft';
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
