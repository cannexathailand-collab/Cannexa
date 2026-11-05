import Link from "next/link";
import {office} from "@/lib/accounts";
import {requireAdminPage} from "@/lib/auth";
import {mockMode} from "@/lib/config";
import {lineSettings} from "@/lib/line-settings";
export const dynamic="force-dynamic";
export default async function AdminLayout({children}:{children:React.ReactNode}){
 const a=await requireAdminPage(office);
 const owner=a.role==="owner", manage=owner||a.role==="admin"||a.role==="manager", approve=owner||a.role==="admin";
 const connected=mockMode()?false:!!await lineSettings();
 return <div className="shell"><aside className="sidebar"><Link href="/admin" className="brand"><span className="mark">↗</span> Affiliate OS</Link><div className="muted small" style={{marginTop:10}}>LINE OA · TRACKING SYSTEM</div><nav aria-label="เมนูหลัก">
 <Link href="/admin">ภาพรวมระบบ</Link>
 {owner&&<Link href="/admin/users">จัดการผู้ใช้</Link>}
 {manage&&<Link href="/admin/affiliates">จัดการ Affiliate</Link>}
 {approve&&<Link href="/admin/reviews">จ่ายค่าคอมมิชชัน</Link>}
 {owner&&<>
  <Link href="/admin/line">เชื่อมต่อ LINE</Link>
  <Link href="/admin/meta">Meta Pixel</Link>
  <Link href="/admin/orders">ออเดอร์จาก LINE</Link>
  <Link href="/admin/audit">ประวัติการดำเนินการ</Link>
 </>}
 <Link href="/account/password">เปลี่ยนรหัสผ่าน</Link>
 <Link href="/privacy">ความเป็นส่วนตัว</Link>
</nav><footer><p>หลักฐานที่ตรวจสอบได้<br/>คือจุดเริ่มต้นของยอดที่เชื่อถือได้</p><span className="pill">MVP · v1.0</span></footer></aside><main className="main"><header className="topbar"><span>WORKSPACE / LINE OFFICIAL ACCOUNT</span><form action="/api/admin/logout" method="post"><button className="secondary">ออกจากระบบ</button></form></header>{mockMode()?<div className="notice">โหมดจำลอง · ทุกข้อมูลจากหน้าทดลองเป็น MOCK ไม่ใช่ผลจาก LINE จริง ห้ามนำไปจ่ายค่าคอม</div>:!connected?<div className="notice">Production · ยังไม่ได้เชื่อม LINE OA · จัดการ Affiliate ได้ แต่ลิงก์ชวนเพิ่มเพื่อนจะเปิดใช้หลังตั้งค่า Channel ครบ</div>:<div className="notice live">โหมด LINE จริง · ระบบนับค่าคอมจากการเพิ่มเพื่อนใหม่ที่ยืนยันได้</div>}{children}</main></div>;
}
