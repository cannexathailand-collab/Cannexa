import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {manualOrderText,createManualOrder} from '../src/lib/manual-orders';
import {parseOrderText} from '../src/lib/order-parser';
import {orderStockItems} from '../src/lib/order-stock-items';
import {quotedTotal} from '../src/lib/shipment-matching';
const input={requestKey:randomUUID(),groupId:'group',sellerCode:'SELLER',customerCode:'C0001',recipient:'Test Buyer',phone:'0812345678',address:'12 Bangkok\n10200',payment:'COD' as const,amountSatang:125050,items:[{code:'TEST',grams:2.5}]};
test('direct orders use the same customer, stock and total parsers as LINE',()=>{
 const text=manualOrderText(input),parsed=parseOrderText(text)!;
 assert.equal(parsed.customerCode,'C0001');assert.equal(parsed.address,'12 Bangkok 10200');
 assert.equal(quotedTotal(text),125050);
 assert.deepEqual(orderStockItems(text).items,[{code:'TEST',quantityMilliG:2500}]);
});
test('direct order rejects injected single-line fields and invalid quantities before persistence',async()=>{
 await assert.rejects(createManualOrder('owner',{...input,sellerCode:'SELLER\nยอดรวม: 1'}),/กรุณากรอก/);
 await assert.rejects(createManualOrder('owner',{...input,items:[{code:'TEST',grams:0}]}),/กรุณากรอก/);
});
test('payment slip content is not copied into the order text',()=>{
 const text=manualOrderText({...input,payment:'โอน',slip:'data:image/png;base64,iVBORw0KGgo='});
 assert.ok(text.includes('ชำระเงิน: โอน'));
 assert.ok(!text.includes('base64'));
});
