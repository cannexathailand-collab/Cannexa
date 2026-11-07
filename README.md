# LINE OA Affiliate Tracking System

MVP ภาษาไทย: Next.js App Router + TypeScript + Tailwind CSS + Next.js Route Handlers + PostgreSQL/Prisma พร้อม QR Code PNG, LINE Login, Webhook, ตรวจหลักฐานและอนุมัติค่าคอม

## ข้อจำกัดที่ต้องเข้าใจก่อนใช้งาน

**ไม่มีการอนุมัติเพื่อนใหม่อัตโนมัติ** friendFlag=true ยืนยันเฉพาะมิตรภาพปัจจุบัน, friendship_status_changed=true อาจเป็นเพิ่มเพื่อนหรือปลดบล็อก, isUnblocked=false และการไม่มีประวัติในฐานข้อมูลไม่ใช่หลักฐานการเพิ่มครั้งแรกในชีวิต ระบบจึงให้ Pending Review แม้ทั้งสามแหล่งดูสอดคล้องกัน

VERIFIED_NEW_FRIEND หมายถึงผู้ดูแลตรวจหลักฐานเพิ่มเติมแล้วอนุมัติตามนโยบายธุรกิจ **ไม่ใช่คำรับรองจาก LINE ว่าเพิ่งเพิ่มครั้งแรกในชีวิต** หากเจ้าของระบบไม่มีหลักฐานเพิ่มเติมที่ตรวจสอบได้ ให้คง Pending หรือปฏิเสธ ห้ามจ่ายด้วยการเดา

ระบบไม่ได้เป็นเว็บขายสินค้า ไม่มีตะกร้า ไม่มี payment gateway และไม่ส่งข้อความ LINE อัตโนมัติ การกด Paid คือบันทึกว่าผู้ดูแลจ่ายเงินภายนอกระบบแล้ว

## เริ่มใช้งานในเครื่อง

ต้องมี Node.js 22.12+ และ PostgreSQL 17 (ติดตั้งเอง หรือ Docker Desktop) ใช้ npm หรือ pnpm ก็ได้

~~~powershell
cd <โฟลเดอร์โปรเจกต์>
npm install
# ใช้รหัสผ่านจริงที่เดายาก อย่างน้อย 16 ตัวอักษร; อย่า commit ลง Git
$env:SETUP_ADMIN_PASSWORD = "<รหัสผ่านผู้ดูแลของคุณ>"
node scripts/setup-secrets.mjs
Remove-Item Env:SETUP_ADMIN_PASSWORD
docker compose up -d db
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
~~~

สคริปต์ setup สร้าง .env จาก .env.example และสร้าง secrets โดยไม่พิมพ์ค่าออกมา หากมี .env แล้วจะไม่เขียนทับ แก้ DATABASE_URL และ DIRECT_URL ให้ตรงกับ PostgreSQL ของคุณก่อน migrate

เปิด [Dashboard ในเครื่อง](http://localhost:3000/admin) แล้วเข้าสู่ระบบด้วยรหัสผ่านที่ตั้งไว้ Seed เพิ่มเพียง Affiliate ตัวอย่าง 3 คน ไม่สร้างยอด LINE ปลอม การ Login จำลองเกิดจากหน้า /mock เท่านั้น มีป้าย MOCK และเก็บ source=MOCK ในฐานข้อมูล แยกฐานข้อมูลทดสอบออกจาก production เสมอ ห้ามเปิด production จากฐานข้อมูลจำลอง

ทดสอบโดยเปิด /r/AFF001 เลือกสถานการณ์ แล้วเปิด Dashboard ดูผล ใช้รหัสลูกค้าจำลองเดิมกับ /r/AFF002 เพื่อทดสอบป้องกันค่าคอมซ้ำ ทดสอบแต่ละสถานการณ์ด้วยรหัสผู้ใช้ใหม่เพื่อไม่ให้ประวัติเก่าปนกัน

**Mock ใช้ได้เฉพาะ npm run dev** เมื่อ NODE_ENV=production จะห้าม MOCK_MODE=true และปิด endpoint จำลอง ในโหมด LINE จริงต้องตั้ง MOCK_MODE=false ไม่มี admin password สำเร็จรูป

## สถาปัตยกรรม

~~~mermaid
flowchart LR
  A[ลูกค้าสแกน QR] --> B[GET /r/AFF001]
  B --> C[(Click + OAuthAttempt)]
  B --> D[LINE Login / PKCE / Add Friend]
  D --> E[Callback: state + browser cookie + consume once]
  E --> F[Token exchange + verify ID Token]
  F --> G[Friendship API]
  G --> H[Serializable transaction + user advisory lock]
  W[Signed LINE Webhook] --> H
  H --> P[(PostgreSQL: Evidence / Conversion / History)]
  P --> R[Pending Review]
  R --> M[Admin ตรวจหลักฐานภายนอก]
  M --> K[(Commission + AuditLog)]
  K --> Z[Dashboard / CSV / Paid]
~~~

- Route Handlers ทำงานบน Node runtime ตามค่าเริ่มต้นของ Next.js รองรับ Vercel
- OAuth state สุ่ม 256-bit เก็บเฉพาะ hash ผูกกับ cookie ของ browser แยกแต่ละ state รองรับหลายแท็บ อายุ 10 นาที consume ด้วย updateMany compare-and-set เพียงครั้งเดียว
- ใช้ PKCE S256, nonce และตรวจ ID Token ผ่าน LINE verify endpoint เพิ่มการตรวจ issuer/audience/nonce/expiry/sub ฝั่งเซิร์ฟเวอร์
- ขอ scope openid และ profile เพื่อให้ตรวจสถานะเพื่อนผ่าน LINE ได้ ไม่อ่านโปรไฟล์/ชื่อ/โทรศัพท์/อีเมล ไม่เก็บ access token, refresh token หรือ ID token
- รับ webhook เป็น raw body และตรวจ HMAC-SHA256 ด้วย Messaging Channel Secret ก่อน parse ตรวจ destination ด้วย LINE_BOT_USER_ID
- ไม่ต้องใช้ Messaging Channel Access Token เพราะ MVP รับ webhook อย่างเดียว ไม่เรียกส่งข้อความ
- เก็บ LINE User ID เป็น HMAC ด้วย USER_HASH_SECRET เพื่อเชื่อมหลักฐานและป้องกันนับซ้ำ ไม่เก็บ raw LINE User ID
- ธุรกรรมใช้ Serializable + PostgreSQL advisory transaction lock ต่อ user และ retry P2034/P2002 สูงสุด 4 ครั้ง ฐานข้อมูล enforce unique อีกชั้น
- Admin ใช้รหัสผ่าน scrypt, signed HttpOnly cookie 8 ชั่วโมง, SameSite=Lax, Secure บน production และตรวจ Origin สำหรับ POST
- Rate limit เก็บใน PostgreSQL ไม่ใช่ memory แต่เป็น global login limit 20 ครั้ง/15 นาทีและ tracking limit ต่อลิงก์ 5,000/15 นาที ควรเพิ่ม WAF ตามปริมาณใช้งานจริง
- Audit บันทึกใน transaction เดียวกับการเปลี่ยนแปลง ไม่มี API แก้หรือลบ Audit ในแอป แต่ผู้มีสิทธิ์ DB ยังแก้ได้ หากต้องการ tamper-proof ให้ตั้ง role/trigger หรือ external archive

## โครงสร้างฐานข้อมูล

| ตาราง | หน้าที่ / ข้อกำหนดสำคัญ |
|---|---|
| Affiliate | รหัส unique, ชื่อ, หมายเหตุ, ระงับ, อัตราหน่วยสตางค์ |
| TrackingLink | 1 ลิงก์ต่อ Affiliate, มี Link ID แยก |
| Click | Click ID, Link ID, Affiliate ID, เวลา, Login result, user HMAC, source |
| OAuthAttempt | state hash unique, browser hash, PKCE verifier, nonce, expiry, consume |
| Conversion | userKey unique ทั่วระบบ, Click ID unique, Attribution, หลักฐาน, snapshot อัตรา |
| StatusHistory | ประวัติ Login / Verified Friend / การตัดสินใจ |
| WebhookEvent | webhookEventId unique, user HMAC, type, eventAt, receivedAt, isUnblocked |
| Commission | conversionId unique, ยอดสตางค์, Pending/Approved/Paid/Rejected |
| AuditLog | ผู้ดำเนินการ, action, entity, รายละเอียดก่อน/หลังและเหตุผล |
| RateLimit | จำกัดความถี่แบบใช้ร่วมกันทุก instance |

ดู schema ใน prisma/schema.prisma และ initial SQL ใน prisma/migrations/202611040001_init/migration.sql

### Attribution และการป้องกันนับซ้ำ

ยึด **การ Login สำเร็จครั้งแรกที่บันทึก transaction สำเร็จ** (first authenticated touch) ภายใน OAuth 10 นาที ไม่ใช่คลิกแรกที่ยังไม่รู้ตัวตน การคลิก A ก่อนแต่ Login B สำเร็จก่อนจะให้ B การสแกน/กลับมา Login ภายหลังไม่ย้าย Affiliate และไม่สร้าง Conversion อีก แยกจำนวน Login จากจำนวนผู้ใช้ Conversion จึงอาจเห็น Login มากกว่าจำนวนเพื่อน

อัตราค่าคอม snapshot เมื่อสร้าง Conversion การเปลี่ยนอัตราไม่เปลี่ยนรายการย้อนหลัง เงินคำนวณด้วย integer satang ไม่ใช้ float จ่ายจริง

การเปลี่ยน Affiliate code เปลี่ยน URL ด้วย ลิงก์/QR รหัสเก่าใช้ไม่ได้ ควรรักษารหัสที่พิมพ์แจกแล้วและแก้เฉพาะชื่อหรือสถานะ

### นโยบายสถานะ

| สถานะ | ความหมาย / ค่าคอม |
|---|---|
| CLICKED | เปิดลิงก์เท่านั้น ไม่คิดค่าคอม |
| LOGIN_SUCCESS | ตรวจตัวตนแล้ว บันทึก Click และ history |
| VERIFIED_FRIEND | API ยืนยันเป็นเพื่อนปัจจุบัน บันทึก history ไม่ใช่เพื่อนใหม่ |
| VERIFIED_NEW_FRIEND | ผู้ดูแลอนุมัติด้วยหลักฐานเพิ่มเติมเท่านั้น |
| EXISTING_FRIEND | มี signed follow เก่าก่อนคลิก ไม่คิดค่าคอม |
| UNBLOCKED | มีประวัติ block/unblock ที่ขัดกับการเพิ่มใหม่ ไม่คิดค่าคอม |
| NOT_FRIEND | API ยืนยันไม่เป็นเพื่อน ไม่คิดค่าคอม |
| PENDING_REVIEW | ไม่แน่นอน/API ล่ม ไม่มีการตั้งหนี้อัตโนมัติ |
| REJECTED | ผู้ดูแลปฏิเสธ ไม่คิดค่าคอม |

API ล่มหลังตรวจ ID Token สำเร็จยังนับ Login แต่ไม่ยืนยันเพื่อน ลูกค้าสแกนซ้ำเพื่อ recheck ได้โดยไม่ย้าย Attribution หาก token exchange/ID verify ล้มเหลวจะบันทึก Login FAILED และให้เริ่มใหม่ การใช้ OAuth code ซ้ำถูกปฏิเสธ ไม่มีการลองใช้ code ที่ consumed แล้วซ้ำ

Webhook บันทึกได้ทั้งก่อน/หลัง callback และ deduplicate ด้วย webhookEventId ข้อมูล follow ที่มาทีหลังไม่เขียนทับ friendFlag ซึ่งเป็นผล API ณ เวลาเช็ค ประวัติเก่าที่ส่งมาช้าอาจตัดสิทธิ์/ถอนยอด Approved ที่ยังไม่จ่ายโดยมี Audit หากจ่ายแล้วจะบันทึก PAID_RECONCILIATION_REQUIRED คง Paid เป็นประวัติจ่ายจริง ผู้ดูแลต้องแก้ไขภายนอก ไม่ย้อนข้อมูลว่าจ่ายแล้ว

Pending ยังไม่มี Commission row เพื่อไม่สร้างภาระจ่ายโดยไม่มีหลักฐาน UI แสดง Pending เสมือน; enum รองรับ Pending หากขยาย workflow ภายหลัง อนุมัติต้องเป็น Pending Review + friendFlag=true + Affiliate active + เหตุผลหลักฐานอย่างน้อย 20 ตัวอักษร จำนวนตัวอักษรเป็น validation ของบันทึก **ไม่ได้พิสูจน์ว่าหลักฐานที่ผู้ดูแลกรอกเป็นจริง** ผู้ดูแลต้องตรวจด้วยตนเอง

## หน้าจอและ API

| เส้นทาง | การทำงาน |
|---|---|
| /login | เข้าสู่ระบบ Admin |
| /admin | 8 KPI, กราฟเปรียบเทียบ, ตาราง, ช่วง 24 ชั่วโมง/7 วัน/30 วัน/ทั้งหมด |
| /admin/affiliates | เพิ่ม/แก้ไข/ระงับ/อัตราค่าคอม/ลิงก์/ดาวน์โหลด QR PNG |
| /admin/reviews | 100 รายการล่าสุด หลักฐานและอนุมัติ/ปฏิเสธ/บันทึก Paid |
| /admin/audit | Audit 200 รายการล่าสุด |
| /r/:code | สร้าง Click และ OAuth session, ไป LINE หรือ mock |
| /api/line/callback | ตรวจ OAuth และหลักฐาน LINE |
| /api/line/webhook | รับ signed follow/unfollow |
| /api/admin/export?period=month | CSV UTF-8 BOM พร้อมป้องกัน formula injection |
| /result | แสดงผลแบบ cookie-signed ไม่เปิดเผย LINE User ID พร้อมเปิดแชท |
| /privacy | Privacy Notice ที่เจ้าของต้องเติมข้อมูลจริง |
| /mock | ทดลองสถานการณ์เฉพาะ development |

CSV คอลัมน์ commissionSatang มีหน่วยสตางค์ Dashboard แสดงหน่วยบาท ช่วงวันที่เป็น rolling window ไม่ใช่เดือนปฏิทิน รายงานตาม cohort เวลา Click/Conversion ของแต่ละ KPI ไม่ใช่วันที่จ่าย

## ตั้งค่า LINE Developers ด้วยตนเอง

1. สร้าง Provider และ LINE Login channel ชนิด Web app ใน LINE Developers
2. สร้าง/เปิด Messaging API ของ LINE OA และตรวจว่า channel อยู่ **Provider เดียวกัน** เพื่อให้ user ID ตรงกัน
3. ใช้บัญชีที่เป็น Admin ทั้ง Login channel และ OA ใน Login channel > Basic settings > Linked LINE Official Account เลือก OA และบันทึก
4. ตั้ง callback URL แบบตรงตัว: https://yourdomain.com/api/line/callback
5. กำหนด privacy policy URL เป็น https://yourdomain.com/privacy และเติมชื่อผู้ควบคุมข้อมูล/ช่องทางใช้สิทธิ/นโยบายจริง
6. นำ Login Channel ID และ Login Channel Secret ใส่ LINE_LOGIN_CHANNEL_ID / LINE_LOGIN_CHANNEL_SECRET
7. นำ **Messaging Channel Secret** ใส่ LINE_MESSAGING_CHANNEL_SECRET (เป็นคนละ secret กับ Login)
8. ใส่ LINE_BOT_USER_ID จาก Basic settings ของ Messaging channel สำหรับตรวจ destination; LINE_OA_BASIC_ID เป็น @basicid สำหรับปุ่มเปิดแชท
9. ตั้ง webhook URL: https://yourdomain.com/api/line/webhook และเปิด Use webhook รวมทั้ง webhook redelivery
10. ตั้ง MOCK_MODE=false แล้วทดสอบ Verify webhook (events ว่างต้องตอบ 200) และทดสอบบัญชีทดสอบจริง ก่อน Publish LINE Login channel สำหรับลูกค้าทั่วไป
11. ทดสอบ iPhone Safari, Android Chrome, กล้องสแกน QR และ LINE in-app browser พร้อมกรณีปฏิเสธสิทธิ์/เพิ่มเพื่อน/เพื่อนเดิม/บล็อกและปลดบล็อก

bot_prompt=aggressive ถูกใส่ใน source แล้ว ไม่ต้องให้ลูกค้าพิมพ์รหัสหรือส่งแชท หน้าจอเพิ่มเพื่อนถูกควบคุมโดย LINE ปุ่มเปิดแชทใช้ oaMessage URL scheme

## Deploy Vercel + Neon/Supabase

1. สร้าง Git repository จากโฟลเดอร์นี้ โดยไม่ commit .env, node_modules, .next หรือ work
2. สร้าง PostgreSQL production ที่ Neon หรือ Supabase แยกจาก development
3. DATABASE_URL ใช้ pooled connection ที่รองรับ Prisma; DIRECT_URL ใช้ direct/session connection สำหรับ migrations พร้อม TLS ตามผู้ให้บริการ อย่าปิด certificate validation
4. ติดตั้ง dependencies และรัน npm run db:migrate จากเครื่อง/CI ที่เชื่อม direct database ได้ ใช้ migration deploy สำหรับ production ไม่ใช้ migrate dev หรือ db push · Vercel production build รัน prisma migrate deploy ให้อัตโนมัติผ่าน scripts/vercel-migrate.mjs (ต้องตั้ง DATABASE_URL และ DIRECT_URL ใน Production) ส่วน Preview และการ build ในเครื่องจะข้ามขั้นตอนนี้
5. Import repo ใน Vercel เลือก Next.js กำหนด Node.js 22.x หรือ 24.x และ build command npm run build
6. สร้าง secrets ใหม่สำหรับ production ด้วย setup script ในสภาพแวดล้อมส่วนตัว เก็บ USER_HASH_SECRET ให้คงที่และสำรองอย่างปลอดภัย การเปลี่ยน key โดยไม่มี migration ทำให้ตรวจนับซ้ำผิดได้
7. ตั้ง environment variables จาก .env.example ใน Vercel: APP_URL เป็นโดเมน HTTPS จริง, MOCK_MODE=false, database, admin hash/salt, secrets และ LINE credentials ให้ครบ
8. Deploy แล้วนำโดเมนจริงไปตั้ง callback/webhook และ Privacy URL ใน LINE Console ห้ามใช้ preview URL แทน production callback ถาวร
9. สร้าง Affiliate จริงผ่าน Admin (ห้ามใช้ seed ใน production) ตรวจ QR URL และทดสอบครบวงจรด้วย LINE จริงก่อนแจกคูปอง
10. ตั้ง backup/restore, monitoring 5xx/webhook failure, trusted admin access, และตั้ง scheduled job จาก CI/server ที่มี database access ให้รัน npm run db:retention ทุกวัน

**ยังไม่ได้ deploy ให้** เนื่องจากยังไม่มีฐานข้อมูล production, LINE Credentials หรือบัญชี Vercel ในงานนี้ ไม่ใช้ Sites hosting แทนสแตก Next.js/PostgreSQL ที่ระบุ

## Privacy และ retention

- เก็บข้อมูลเท่าที่จำเป็น ไม่มีชื่อ/โทรศัพท์/อีเมลจากลูกค้า
- OAuth attempts ที่หมดอายุถูกลบด้วย retention job รายวัน; access token และ ID token ไม่ persist
- ค่า RETENTION_DAYS เริ่มต้น 180 วัน (ต่ำสุด 30) ล้าง status history และ Click ที่ไม่มี Conversion เกินอายุ
- Conversion, Click ที่ผูก Conversion, user HMAC, Webhook metadata ที่จำเป็นต่อประวัติ anti-fraud และบัญชี/Audit คงอยู่เป็นทะเบียนขั้นต่ำ เพื่อไม่ลืมเพื่อนเก่าแล้วนับซ้ำ
- **MVP ไม่ลบทะเบียนขั้นต่ำโดยอัตโนมัติ** เจ้าของต้องกำหนดฐานกฎหมายและระยะเก็บทะเบียน/บัญชีจริง จัดขั้นตอนคำขอลบและระงับสิทธิ์ก่อนเปิดบริการ HMAC ยังเป็นข้อมูลนามแฝง ไม่ใช่ข้อมูลนิรนามอย่างสมบูรณ์
- Privacy Notice ที่ให้เป็นแม่แบบ ไม่ใช่การรับรองความสอดคล้องกับ PDPA
- ไม่ log payload/token ใน source แต่ผู้ดูแลต้องตั้ง log redaction ที่แพลตฟอร์มด้วย OAuth query string อาจปรากฏใน access logs
- เปลี่ยน SESSION_SECRET เพื่อ revoke admin session ทั้งหมด; Admin MVP มีผู้ดูแลบัญชีเดียว จึง Audit actor เป็น admin ไม่มี multi-user/MFA ในรุ่นนี้

## การทดสอบ

~~~bash
npm test
npm run typecheck
npm run build
~~~

29 automated tests: นโยบายหลักฐาน, ค่าคอม, signature/tampering, PKCE URL, ID token nonce, LINE friendship timeout, scan redirect/Click/OAuth creation, QR PNG, หลาย Affiliate, ลูกค้าซ้ำ, webhook ซ้ำ, API recovery, approve/paid retry, และ historical webhook ที่มาช้า

LINE API และ Prisma transaction ถูก mock ในชุดทดสอบนี้ ไม่ต้องมี LINE Credentials หรือ PostgreSQL เพื่อรัน tests ชุดนี้ **ไม่ได้พิสูจน์ concurrency/unique constraint กับ PostgreSQL จริง** ต้องทดสอบ concurrent callbacks/webhook/review กับ staging PostgreSQL ก่อนนำไปจ่ายจริง

ผลตรวจและข้อจำกัดล่าสุดดู TEST-REPORT.md ก่อน deploy

## เอกสารอ้างอิงทางการ

- [LINE Login integration](https://developers.line.biz/en/docs/line-login/integrate-line-login/)
- [LINE Login API / Friendship](https://developers.line.biz/en/reference/line-login/)
- [Add friend option และข้อจำกัด](https://developers.line.biz/en/docs/line-login/link-a-bot/)
- [Messaging API](https://developers.line.biz/en/reference/messaging-api/)
- [LINE URL scheme](https://developers.line.biz/en/docs/messaging-api/using-line-url-scheme/)
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)

## งานต่อหลัง MVP

Pagination/aggregation สำหรับข้อมูลขนาดใหญ่, ผู้ดูแลหลายบัญชีและ MFA, evidence attachment storage, monitoring/reconciliation queue, การเก็บ audit แบบแก้ไม่ได้, ขั้นตอนลบข้อมูลตามสิทธิ์ และ stress/integration tests บน PostgreSQL จริง Dashboard ปัจจุบันอ่าน cohort records มาสรุปในแอป เหมาะกับ MVP ไม่ใช่รายงานระดับล้านรายการ

## แก้ไข 1.0.1 หลังตรวจ Error

- บล็อกหรือปลดบล็อกหลัง Login แต่ก่อนอนุมัติ: เปลี่ยนเป็น UNBLOCKED และห้ามอนุมัติจาก friendFlag เก่า
- การ Login ตรวจซ้ำพิจารณาประวัติ block/unblock ที่ใหม่กว่า Conversion แรกด้วย
- กิจกรรมบล็อกที่เกิดหลังอนุมัติแล้วเพียงอย่างเดียวไม่ถอนค่าคอมย้อนหลัง โดยหลักฐานประวัติก่อนการได้สิทธิ์ที่ส่งมาช้ายังคงตรวจและถอนยอดที่ยังไม่จ่ายตามเดิม
- เพิ่ม regression tests 4 ข้อ รวมเป็น 29 ข้อ

## GitHub และ Vercel

Repository นี้วาง package.json ไว้ที่ root: ใน Vercel เลือก Root Directory เป็น . และ Framework เป็น Next.js ใช้ Node.js 24 และ pnpm ตาม packageManager ใน package.json หากใช้ Corepack บน Vercel ให้ตั้ง ENABLE_EXPERIMENTAL_COREPACK=1

ไม่เก็บ .env, next-env.d.ts ที่ generate ในเครื่อง, ฐานข้อมูลตัวอย่าง, node_modules หรือ build artifacts ใน GitHub ให้ตั้ง Secrets ผ่าน Environment Variables ของโฮสต์ ใช้ PostgreSQL production แยกต่างหากและตั้ง MOCK_MODE=false

GitHub Actions ตรวจ tests และ build โดยไม่ต้องมี LINE Credentials ไม่รัน migration หรือ seed กับฐานข้อมูลจริงอัตโนมัติ
