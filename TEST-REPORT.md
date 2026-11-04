# รายงานการตรวจสอบ MVP
วันที่ 4 พฤศจิกายน 2026

## ผลตรวจรุ่นเดิม 1.0.0 (ก่อนแก้ Error)

- Automated tests: **25 ผ่าน / 0 ไม่ผ่าน**
- TypeScript strict check: ผ่าน (ตรวจแยกและตรวจใน Next.js production build)
- Prisma Client generate 6.19.3: ผ่าน
- Initial PostgreSQL migration SQL generated: ผ่าน (ยังไม่ได้ apply กับ PostgreSQL จริง)
- Next.js 16.4.4 production build ผ่านด้วย Webpack
- HTTP smoke test จาก production server: **6 ผ่าน / 0 ไม่ผ่าน**
  - /login → 200
  - /privacy → 200
  - /admin โดยไม่มี session → 307 ไป Login
  - /api/admin/export โดยไม่มี session → 401
  - /api/admin/qr/AFF001 โดยไม่มี session → 401
  - /mock ใน production → 404

## ขอบเขต automated tests

1. เป็นเพื่อนปัจจุบัน + changed + follow ยังเป็น Pending Review
2. มีประวัติเพื่อนเก่า → Existing Friend
3. มีหลักฐานปลดบล็อก → Unblocked
4. API ไม่ทราบผล → Pending
5. ไม่เป็นเพื่อน → Not Friend
6. การอนุมัติต้องมีสถานะและหลักฐานครบ
7. รวมค่าคอมเฉพาะ Approved/Paid
8. 100 รายการ x 5 บาท = 500 บาท
9. ตรวจ signature จาก raw body และปฏิเสธการแก้ไข
10. Session tampering และ HMAC user identity
11. Authorization URL: PKCE S256, state, nonce, aggressive
12. CSV formula injection รวมช่องว่างนำหน้า
13. LINE token verify สำเร็จแต่ friendship timeout → null
14. ID token nonce ไม่ตรงต้องปฏิเสธ
15. สแกนลิงก์ → Click + OAuth + redirect MOCK + HttpOnly cookie
16. สร้าง QR PNG
17. ผู้ใช้ใหม่ที่ยังพิสูจน์ครั้งแรกไม่ได้ → ไม่มี Commission
18. หลาย Affiliate → First authenticated touch + rate snapshot
19. LINE user เดิมกลับมา → Conversion เดียว
20. Signed follow เก่าก่อนคลิก → Existing Friend
21. Unblocked ไม่อนุมัติค่าคอม
22. Webhook ซ้ำ → event เดียว
23. API กลับมาปกติ → recheck โดยไม่ย้าย Attribution
24. Approve/Paid retry ไม่สร้างซ้ำ ยอดคงเดิมและมี Audit
25. Historical webhook มาช้า → ถอนยอด Approved ที่ยังไม่จ่ายพร้อม Audit

ใช้ LINE API mocks และ Prisma transaction mock แบบ in-memory ไม่มีผลทดสอบจำลองใดถูกแสดงเป็นผล LINE จริง

## ยังไม่ได้ทดสอบหรือเชื่อมต่อ

- ไม่มี LINE Credentials: ยังไม่ได้ทดสอบ OAuth, Add Friend, friendship API และ webhook แบบ end-to-end กับ LINE จริง
- ไม่มี PostgreSQL/Docker ในเครื่องนี้: ยังไม่ได้ apply migration, seed, ทดสอบ DB transaction/advisory lock/concurrent requests จริง
- ยังไม่ได้ทดสอบ Dashboard CRUD หลัง Login กับฐานข้อมูลจริง
- ยังไม่ได้ทดสอบด้วย iPhone/Android หรือ browser visual QA
- ยังไม่ได้ deploy ไป Vercel, Supabase หรือ Neon
- Privacy Notice ยังเป็นแม่แบบ ต้องเติมข้อมูลผู้ควบคุมข้อมูลและนโยบายจริง

## วิธีตรวจซ้ำ

ติดตั้ง dependency แล้วรัน npm test, npm run typecheck, npm run build ตาม README

Windows sandbox ไม่อนุญาตสร้าง symlink บางตำแหน่ง ทำให้ Turbopack build รอบแรกไม่ผ่าน เปลี่ยน scripts เป็น next build --webpack และ next dev --webpack แล้ว build ผ่าน ไม่ต้องเปิดสิทธิ์เพิ่มเติมเพื่อ build

## เกณฑ์ก่อนเปิดจ่ายเงินจริง

เชื่อม staging PostgreSQL และ LINE จริง ทดสอบอย่างน้อย callback/webhook ทุกลำดับเวลา, concurrent Login ผู้ใช้เดียวกันหลายลิงก์, webhook redelivery, API outage, manual approve/paid retry, restore backup และ mobile flow ให้ครบ ห้ามตีความชุดทดสอบแบบ mock ว่ารับรองความแม่นยำกับ LINE จริงหรือ concurrency ฐานข้อมูลแล้ว

friendFlag, callback changed และ isUnblocked ไม่รับรองการเพิ่มเพื่อนครั้งแรกในชีวิต ไม่มี auto commission; ต้องมีหลักฐานภายนอกและการอนุมัติตามนโยบายธุรกิจ

## ตรวจ Error รอบ 1.0.1

- ชุดเดิม 25 ข้อผ่าน แต่เพิ่ม regression tests แล้วพบ 3 ข้อผิดพลาดด้านช่วงเวลาของหลักฐาน block/unblock
- แก้ทั้ง 3 กรณี และเพิ่มการทดสอบไม่ถอนยอดที่ได้สิทธิ์แล้วเพราะบล็อกภายหลัง รวม automated tests 29 ผ่าน / 0 ไม่ผ่าน
- TypeScript strict check หลังแก้: ผ่าน
- ไม่มี .env หรือ .env.local ในโปรเจกต์นี้ ต้องสร้างและตั้ง PostgreSQL ก่อนใช้ส่วนฐานข้อมูล
- การตรวจ production build รุ่น 1.0.1: **ยังไม่ผ่านในสภาพแวดล้อมนี้** ติด EPERM mkdir ภายใน .next ทั้งช่วง compile และ prerender แม้ขอสิทธิ์เขียนเพิ่มเติมแล้ว รอบหนึ่ง compile และ TypeScript สำเร็จแต่ prerender /_global-error สร้างโฟลเดอร์ไม่ได้ จึงไม่อ้างว่ารุ่นแก้ไข build ผ่าน
- HTTP smoke 6 ข้อด้านบนเป็นผลรุ่นเดิม ยังไม่ได้รันซ้ำกับ build รุ่น 1.0.1 ที่สมบูรณ์
- ไม่เปลี่ยนหรือข้าม ACL ของ Windows เพื่อหลบข้อจำกัด ต้องตรวจ build อีกครั้งในเครื่องที่มีสิทธิ์หรือ CI ก่อน deploy

## อัปเดตหลังเปิดโปรแกรมตัวอย่าง

เปิด PostgreSQL แบบพกพาในเครื่องและ apply initial migration สำเร็จ รัน seed และ fixture MOCK ผ่าน ฟังก์ชัน transaction/advisory lock ถูกเรียกกับ PostgreSQL จริงในการเตรียมตัวอย่างแล้ว ตรวจ HTTP หลัง Login: Dashboard, Affiliates, Reviews, Audit, CSV, QR ผ่าน และทดสอบ tracking -> mock Login -> Pending Review ผ่าน ไม่ถือเป็น stress/concurrency test หรือผล LINE จริง

แก้สคริปต์ seed/retention ให้โหลด .env ด้วย scripts/load-env.ts แล้ว
