import test from "node:test";
import assert from "node:assert/strict";
import {parseOrderText} from "../src/lib/order-parser";
test("only explicit order headers are collected",()=>{
 assert.equal(parseOrderText("สวัสดีครับ\nรหัสผู้ขาย: ADM001"),null);
 assert.equal(parseOrderText("ข้อความทั่วไป 1000 บาท"),null);
});
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
