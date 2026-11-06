import test from "node:test";
import assert from "node:assert/strict";
import {parseOrderText} from "../src/lib/order-parser";
test('invalid or missing phone is flagged while formatted domestic and international phones pass',()=>{
 const parse=(phone:string)=>parseOrderText('รหัสผู้ขาย: ADM001\nชื่อผู้รับ: ทดสอบ\nเบอร์โทร: '+phone+'\nที่อยู่: กรุงเทพ\nชำระเงิน: COD')!;
 for(const value of ['', 'abc','081234','081234567890','0000000000','+660812345678'])assert.ok(parse(value).issues.some(i=>i.includes('เบอร์โทร')),value);
 for(const value of ['081-234-5678','02 123 4567','+66 81 234 5678'])assert.ok(!parse(value).issues.some(i=>i.includes('เบอร์โทร')),value);
});
test("only explicit order headers are collected",()=>{
 assert.equal(parseOrderText("สวัสดีครับ\nรหัสผู้ขาย: ADM001"),null);
 assert.equal(parseOrderText("ข้อความทั่วไป 1000 บาท"),null);
});
test("seller header accepts current username format including dots and preserves original case",()=>{assert.equal(parseOrderText("รหัสผู้ขาย: Ink.123")?.sellerCode,"Ink.123");assert.equal(parseOrderText("รหัสผู้ขาย: "+"a".repeat(64))?.sellerCode.length,64);});
test("structured intake extracts recipient matching fields without financial posting",()=>{
 const p=parseOrderText("รหัสผู้ขาย: ADM001\nชื่อผู้รับ: ทดสอบ\nเบอร์โทร: 081-234-5678\nที่อยู่: 1 กรุงเทพ\nชำระเงิน: cod\nสินค้า: CG13 20g 1200\nยอดรวม: 1260")!;
 assert.deepEqual(p,{sellerCode:"ADM001",recipient:"ทดสอบ",phone:"0812345678",address:"1 กรุงเทพ",payment:"COD",issues:[]});
 assert.equal("amountSatang" in p,false);
});
test("legacy unlabelled orders are retained for review rather than guessed",()=>{
 const p=parseOrderText("รหัสผู้ขาย: ADM001\nบ้านเลขที่ 1\n0812345678 โทรศัพท์\nCg13 20g 1200\ncod=1260\nลูกค้าทดสอบ")!;
 assert.equal(p.recipient,null);assert.equal(p.phone,null);assert.equal(p.issues.length,4);
});
test("payment text is never treated as proof of collection",()=>{
 const p=parseOrderText("รหัสผู้ขาย: ADM001\nผู้รับ: ทดสอบ\nโทร: 0812345678\nที่อยู่: 1\nชำระเงิน: โอน")!;
 assert.equal(p.payment,"โอน");assert.equal("paid" in p,false);
 assert.ok(parseOrderText("รหัสผู้ขาย: ADM001\nโทร: abc")!.issues.length);
});
test("claim spelling variants normalize without treating chat selling prices as cost",()=>{
 for(const payment of ["เคลม","เครม"]){const p=parseOrderText("รหัสผู้ขาย: Ink123\nชื่อผู้รับ: ทดสอบ\nโทรศัพท์: 0812345678\nที่อยู่: ที่อยู่ทดสอบ\nรายการสินค้า:\nสินค้า NT16 x 100 = 2900\nสินค้า NT17 x 10 = 350\nยอดสินค้า: 3250 บาท\nค่าส่ง: 50 บาท\nยอดรวม: 3300 บาท\nชำระเงิน: "+payment)!;assert.equal(p.payment,"เคลม");assert.deepEqual(p.issues,[]);assert.equal("costSatang" in p,false);}
});
