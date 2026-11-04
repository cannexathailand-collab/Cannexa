import {metaSettings} from "@/lib/meta";
import {requireAdminPage} from "@/lib/auth";

export default async function MetaPixelSettings() {
 await requireAdminPage(["owner"]);
 return <section className="card">
  <h1>Meta Pixel</h1>
  <p>ใช้วัดผลโฆษณา Facebook จากเหตุการณ์เพิ่มเพื่อน LINE OA ที่ Cannexa ยืนยันแล้ว</p>
  <p><strong>สถานะ:</strong> {metaSettings() ? "ตั้งค่าการส่งเหตุการณ์แล้ว" : "ยังไม่เปิดส่งเหตุการณ์ไป Meta"}</p>
  <p>เตรียม Pixel หรือ Dataset ID และ Conversions API Access Token จาก Meta Events Manager แล้วตั้งค่า META_DATASET_ID, META_ACCESS_TOKEN และ META_GRAPH_VERSION ใน Vercel</p>
  <a className="button secondary" href="https://business.facebook.com/events_manager2/">เปิด Meta Events Manager</a>
 </section>;
}
