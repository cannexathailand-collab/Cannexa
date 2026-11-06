import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customerCodeMessage} from '../src/lib/customer-code-message';
import {customerTags} from '../src/lib/customer-tags';
test('customer code message gives the existing code and clear order instructions',()=>{
 const text=customerCodeMessage('CUS-00000123');assert.ok(text.includes('C0123'));assert.ok(!text.includes('CUS-'));assert.ok(text.includes('แจ้งรหัสนี้กับพนักงานทุกครั้งเมื่อสั่งซื้อ'));assert.ok(text.includes('เพื่อรับสิทธิพิเศษ สะสมแต้มสำหรับสมาชิก และโปรโมชั่นมากมาย'));assert.ok(text.includes('Your customer code: C0123'));assert.ok(!text.toLowerCase().includes('password'));
});

test('new friend receives one welcome message with their actual short code',()=>{
 const text=customerCodeMessage('CUS-00000123',true);
 assert.equal(text,'ยินดีต้อนรับค่ะ 💚\nรหัสลูกค้าของคุณ: C0123\nแจ้งรหัสนี้กับพนักงานทุกครั้งเมื่อสั่งซื้อ\nเพื่อรับสิทธิพิเศษ สะสมแต้มสำหรับสมาชิก และโปรโมชั่นมากมาย\n\nWelcome! 💚\nYour customer code: C0123\nPlease share this code with our staff every time you place an order.\nEnjoy exclusive member benefits, collect reward points, and access special promotions.');
 assert.ok(!customerCodeMessage('CUS-00000123').includes('ยินดีต้อนรับ'));
});
test('internal tags derive from linked customer, referrer and team data',()=>{
 assert.deepEqual(customerTags({legacy:false,lineUserKey:'key',conversionId:null,referrer:{code:'AFF',name:'Seller'}},['Green Hub · Happy Farm','Green Hub · Happy Farm']),['ลูกค้าใหม่','LINE','ผู้แนะนำ: Seller · AFF','ทีม: Green Hub · Happy Farm']);
});
