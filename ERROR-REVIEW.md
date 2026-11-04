# ผลตรวจ Error รุ่น 1.0.1
ตรวจวันที่ 4 พฤศจิกายน 2026

## ข้อผิดพลาดในโค้ดที่ยืนยันและแก้แล้ว

1. Webhook ปลดบล็อกหลัง Login แต่ก่อนอนุมัติไม่ตัดสิทธิ์: เดิมเทียบเวลา event กับ Conversion แรก ทำให้ยังเป็น Pending Review ที่กดอนุมัติได้ แก้ให้ block/unblock ระงับรายการที่ยังไม่ตัดสินใจทุกกรณี
2. Webhook unfollow หลัง Login แต่ก่อนอนุมัติปล่อยให้ใช้ friendFlag เก่าอนุมัติ: แก้ให้เปลี่ยนเป็น UNBLOCKED (หมายถึงมีประวัติ block/unblock ตามนโยบายแบบระมัดระวัง) และไม่อนุมัติค่าคอม
3. Login ตรวจซ้ำมองข้าม block/unblock ใหม่กว่า Conversion แรก: เอาเงื่อนไขเวลาที่ตัดหลักฐานใหม่ทิ้งออก จึงไม่คืนรายการเป็น Pending ที่อนุมัติได้ทั้งที่มีประวัติขัดแย้ง

แก้ใน src/lib/tracking.ts และเพิ่ม regression tests 4 ข้อใน tests/tracking.test.ts รวมกรณีไม่ถอนยอดที่ได้สิทธิ์ก่อนบล็อกภายหลัง

ผลหลังแก้: **29 tests ผ่าน, 0 ไม่ผ่าน; TypeScript ผ่าน**
ไม่เปลี่ยนฐานข้อมูลหรือ migrations

## ปัญหาสภาพแวดล้อมที่ยังเหลือ

- ไม่มี .env หรือ .env.local: ต้องตั้ง database และ secrets ตาม README ก่อนใช้ Login/CRUD/Tracking จริง ไม่ใส่ credentials สมมติให้
- Production build รุ่นแก้ไขยังยืนยันไม่ได้ใน Windows sandbox นี้ พบ EPERM mkdir ภายใน .next ทั้งช่วง compile และ prerender /_global-error แม้ได้รับสิทธิ์เพิ่ม รอบหนึ่ง compile และ TypeScript ผ่านแต่สร้างโฟลเดอร์ prerender ไม่ได้
- Build รุ่นเดิมเคยผ่าน แต่ไม่ถือเป็นหลักฐานว่า build รุ่นแก้ไขผ่านแล้ว
- ไม่มี PostgreSQL และ LINE Credentials จริง จึงยังไม่ทดสอบ end-to-end หรือ DB concurrency จริง

## วิธีตรวจต่อบนเครื่องเจ้าของระบบหรือ CI

1. แตก ZIP ไปโฟลเดอร์ใหม่ที่บัญชีใช้งานเขียนได้ ติดตั้ง Node.js และ dependencies
2. สร้าง .env ด้วย scripts/setup-secrets.mjs ตาม README และตั้ง PostgreSQL
3. รัน npm test และ npm run typecheck
4. รัน npm run build หากยัง EPERM ให้ตรวจสิทธิ์โฟลเดอร์/การล็อกไฟล์โดยโปรแกรมอื่นกับผู้ดูแลเครื่อง ไม่เปลี่ยนข้อมูลแอปเพื่อหลบสิทธิ์
5. เชื่อม LINE และทดสอบ staging ก่อน deploy หรือใช้ยอดจ่ายจริง

หาก Error ที่ผู้ใช้พบเป็นคนละข้อความ ต้องใช้ข้อความ Error และขั้นตอนก่อนเกิดปัญหาเพื่อวิเคราะห์เฉพาะจุด
