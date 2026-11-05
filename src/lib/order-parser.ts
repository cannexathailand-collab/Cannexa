// Amounts in chat are unverified claims. This intake never creates sales or commission.
export function parseOrderText(text:string){
 const lines=text.replace(/\r/g,"").split("\n").map(x=>x.trim()).filter(Boolean);
 const seller=lines[0]?.match(/^รหัสผู้ขาย\s*[:：]\s*([A-Za-z0-9._-]{3,64})\s*$/);
 if(!seller)return null;
 const field=(labels:string)=>lines.map(x=>x.match(new RegExp("^(?:"+labels+")\\s*[:：]\\s*(.+)$","i"))).find(Boolean)?.[1]?.trim()??null;
 const recipient=field("ชื่อผู้รับ|ผู้รับ|ชื่อลูกค้า");
 const phoneInput=field("เบอร์โทร|โทรศัพท์|โทร|เบอร์");
 const digits=phoneInput?.replace(/[\s()+-]/g,"")??null;
 const phone=digits&&/^(?:0\d{8,9}|66\d{8,9})$/.test(digits)?digits:null;
 const address=field("ที่อยู่|ที่อยู่ผู้รับ");
 const paymentInput=field("ชำระเงิน|วิธีชำระเงิน");
 const payment=paymentInput&&/^(COD|โอน)$/i.test(paymentInput)?paymentInput.toUpperCase():null;
 const issues:string[]=[];
 if(!recipient)issues.push("ไม่พบชื่อผู้รับที่ระบุหัวข้อ");
 if(!phone)issues.push("ไม่พบเบอร์โทรที่ถูกต้อง");
 if(!address)issues.push("ไม่พบที่อยู่ที่ระบุหัวข้อ");
 if(!payment)issues.push("ระบุชำระเงินเป็น โอน หรือ COD");
 return {sellerCode:seller[1],recipient,phone,address,payment,issues};
}
