import {metaAdCode} from "@/lib/meta-ad";
import {baseUrl, mockMode} from "@/lib/config";
import {db} from "@/lib/db";
import {metaDatasetPattern, metaSettings} from "@/lib/meta";
import {requireAdminPage} from "@/lib/auth";

export default async function MetaPixelSettings({searchParams}: {searchParams: Promise<{status?: string; sentAt?: string; trace?: string; http?: string}>}) {
 await requireAdminPage(["owner"]);
 const {status, sentAt, trace, http} = await searchParams;
 const connection = await db.metaConnection.findUnique({where: {id: "default"}});
 const friends = await db.conversion.count({where:{affiliate:{code:metaAdCode},source:mockMode()?"MOCK":"LINE",status:"VERIFIED_NEW_FRIEND"}});
 const adUrl = baseUrl()+"/r/"+metaAdCode;
 const configured = connection && metaSettings();
 return <section className="card">
  <h1>Meta Pixel</h1>
  <p>ส่งเหตุการณ์เมื่อ Cannexa ยืนยันว่าเพิ่มเพื่อน LINE OA สำเร็จจากลิงก์โฆษณา</p>
  <p><strong>สถานะ:</strong> {configured ? "ตั้งค่าครบ รอทดสอบรับเหตุการณ์ใน Meta" : "ยังตั้งค่าการส่งเหตุการณ์ไม่ครบ"}</p>
  {status === "saved" && <p role="status">บันทึก Pixel / Dataset ID แล้ว</p>}
  {status === "invalid" && <p role="alert">กรอก Pixel / Dataset ID เป็นตัวเลขเท่านั้น</p>}
  <form action="/api/admin/meta" method="post">
   <label>Pixel / Dataset ID
    <input name="datasetId" inputMode="numeric" pattern={metaDatasetPattern.source} maxLength={32} defaultValue={connection?.datasetId} required/>
   </label>
   <button type="submit">บันทึก Pixel</button>
  </form>
  <form action="/api/admin/meta" method="post">
   <button name="action" value="test" type="submit">ส่งเหตุการณ์ทดสอบ</button>
  </form>
  {status === "test-missing" && <p role="alert">ตั้งค่า Dataset ID, โทเค็น, เวอร์ชัน API และรหัส Test Events ก่อนส่ง</p>}
  {status === "test-sent" && <p role="status">Meta ตอบรับเหตุการณ์ทดสอบแล้ว เปิด Test Events เพื่อตรวจรายการ</p>}
  {status === "test-rejected" && <p role="alert">Meta ไม่ตอบรับเหตุการณ์ทดสอบ ตรวจ Dataset ID, โทเค็นและรหัส Test Events</p>}
  {status === "test-failed" && <p role="alert">ติดต่อ Meta ไม่สำเร็จ ลองใหม่อีกครั้ง</p>}
  {sentAt && Number.isFinite(Date.parse(sentAt)) && <p>เวลาส่ง {new Date(sentAt).toLocaleString("th-TH", {timeZone:"Asia/Bangkok"})}{http && <> · HTTP {http}</>}{trace && <> · รหัสอ้างอิง Meta <code>{trace}</code></>}</p>}
  <h2>ลิงก์สำหรับโฆษณา Meta</h2>
  <p><a href={adUrl}>{adUrl}</a></p>
  <p>เพื่อนใหม่ที่ยืนยันแล้วจากลิงก์นี้ <strong>{friends} คน</strong></p>
  <p>ตั้งค่า Access Token และเวอร์ชัน Graph API ใน Environment Variables ของ Vercel</p>
  <a className="button secondary" href="https://business.facebook.com/events_manager2/">เปิด Meta Events Manager</a>
 </section>;
}
