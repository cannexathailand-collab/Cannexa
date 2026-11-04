import Link from "next/link";
import {redirect} from "next/navigation";
import {admin} from "@/lib/auth";
import {mockMode} from "@/lib/config";
export const dynamic="force-dynamic";
export default async function AdminLayout({children}:{children:React.ReactNode}){
 try{await admin();}catch{redirect("/login");}
 return <div className="shell"><aside className="sidebar"><Link href="/admin" className="brand"><span className="mark">↗</span> Affiliate OS</Link><div className="muted small" style={{marginTop:10}}>LINE OA · TRACKING SYSTEM</div><nav><Link href="/admin">◫ &nbsp; ภาพรวมระบบ</Link><Link href="/admin/affiliates">♧ &nbsp; จัดการ Affiliate</Link><Link href="/admin/reviews">✓ &nbsp; ตรวจสอบและค่าคอม</Link><Link href="/admin/audit">≡ &nbsp; ประวัติการดำเนินการ</Link><Link href="/privacy">↗ &nbsp; ความเป็นส่วนตัว</Link></nav><footer><p>หลักฐานที่ตรวจสอบได้<br/>คือจุดเริ่มต้นของยอดที่เชื่อถือได้</p><span className="pill">MVP · v1.0</span></footer></aside><main className="main"><header className="topbar"><span>WORKSPACE / LINE OFFICIAL ACCOUNT</span><form action="/api/admin/logout" method="post"><button className="secondary">ออกจากระบบ</button></form></header>{mockMode()?<div className="notice">โหมดจำลอง · ทุกข้อมูลจากหน้าทดลองเป็น MOCK ไม่ใช่ผลจาก LINE จริง ห้ามนำไปจ่ายค่าคอม</div>:<div className="notice live">โหมด LINE จริง · อนุมัติค่าคอมเฉพาะรายการที่ตรวจหลักฐานเพิ่มเติมแล้ว</div>}{children}</main></div>;
}
