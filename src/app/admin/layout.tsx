import Link from "next/link";
import {office} from "@/lib/accounts";
import {requireAdminPage} from "@/lib/auth";
import {mockMode} from "@/lib/config";
import {lineSettings} from "@/lib/line-settings";
import {SidebarNavigation} from '@/app/sidebar-navigation';
import '@/app/sidebar.css';
import {WorkspaceLocation} from '@/app/workspace-location';
export const dynamic="force-dynamic";
export default async function AdminLayout({children}:{children:React.ReactNode}){
 const a=await requireAdminPage(office);
 const owner=a.role==="owner", manage=owner||a.role==="admin"||a.role==="manager", approve=owner||a.role==="admin";
 const connected=mockMode()?false:!!await lineSettings();
 return <div className="shell"><a className="skip-to-content" href="#main-content">ข้ามไปเนื้อหา</a><aside className="sidebar"><Link href="/admin" className="brand"><span className="mark">↗</span> Affiliate OS</Link><div className="muted small" style={{marginTop:10}}>จัดการร้านค้าและสมาชิก</div><SidebarNavigation>
 <details aria-label="Affiliate" className="accounting-menu" open><summary>Affiliate</summary><div className="accounting-submenu"><Link href="/admin">ภาพรวม Affiliate</Link>{manage&&<Link href="/admin/affiliates">ตั้งค่า Affiliate</Link>}</div></details>
 {manage&&<details aria-label="CRM" className="accounting-menu" open><summary>CRM</summary><div className="accounting-submenu"><Link href="/admin/crm">ข้อมูลลูกค้า</Link><Link href="/admin/customers">รหัสลูกค้า</Link><Link href="/admin/crm/tiers">ระดับสมาชิกและเกณฑ์จัดกลุ่ม</Link><Link href="/admin/crm/points">ตั้งค่าสะสมแต้ม</Link></div></details>}
 {owner&&<details aria-label="ออเดอร์" className="accounting-menu"><summary>ออเดอร์</summary><div className="accounting-submenu"><Link href="/admin/orders/list">รายการออเดอร์</Link></div></details>}
 {approve&&<details aria-label="บัญชี" className="accounting-menu"><summary>บัญชี</summary><div className="accounting-submenu">
  <details className="expense-menu" aria-label="ภาพรวมบัญชี"><summary>ภาพรวมบัญชี</summary><div className="expense-submenu"><Link href="/admin/accounting">บัญชีสรุป</Link><Link href="/admin/accounting/daily">บัญชีรายวัน</Link></div></details>
  <Link href="/admin/sales">ยอดขาย</Link>
  <details className="expense-menu"><summary>ค่าใช้จ่าย</summary><div className="expense-submenu"><Link href="/admin/expenses">ภาพรวมค่าใช้จ่าย</Link><Link href="/admin/reviews">จ่ายค่าคอมมิชชัน</Link></div></details>
  <details className="expense-menu"><summary>สต๊อก</summary><div className="expense-submenu"><Link href="/admin/stock">รายการสินค้า</Link><Link href="/admin/stock/history">รายการย้อนหลัง</Link><Link href="/admin/stock/review">รอตรวจสอบ</Link></div></details>
 </div></details>}
 {owner&&<details aria-label="การเชื่อมต่อ" className="accounting-menu"><summary>การเชื่อมต่อ</summary><div className="accounting-submenu">
  <details className="expense-menu" aria-label="เชื่อมต่อ LINE"><summary>เชื่อมต่อ LINE</summary><div className="expense-submenu"><Link href="/admin/line">ตั้งค่า LINE</Link><Link href="/admin/orders">รายการบอทรับออเดอร์จาก LINE</Link></div></details>
  <Link href="/admin/meta">Meta Pixel</Link>
  <Link href="/admin/gmail">เชื่อม Gmail</Link>
 </div></details>}
 <details aria-label="ระบบ" className="accounting-menu"><summary>ระบบ</summary><div className="accounting-submenu">{owner&&<><Link href="/admin/users">จัดการผู้ใช้</Link><Link href="/admin/audit">ประวัติการดำเนินการ</Link></>}<Link href="/account/password">เปลี่ยนรหัสผ่าน</Link><Link href="/privacy">ความเป็นส่วนตัว</Link></div></details>
</SidebarNavigation><footer><p>ข้อมูลร้านค้าในที่เดียว</p><span className="pill">Cannexa Workspace</span></footer></aside><main id="main-content" className="main" tabIndex={-1}><header className="topbar workspace-header"><WorkspaceLocation/><div className="workspace-header-actions">{connected&&!mockMode()&&<span className="workspace-status">ตั้งค่า LINE แล้ว</span>}<form action="/api/admin/logout" method="post"><button className="secondary">ออกจากระบบ</button></form></div></header>{mockMode()?<div className="notice">โหมดจำลอง · ข้อมูลทดสอบไม่นำไปจ่ายค่าคอม</div>:!connected?<div className="notice">ยังไม่ได้เชื่อม LINE OA · <Link href="/admin/line">ตั้งค่าการเชื่อมต่อ</Link> เพื่อเปิดใช้ลิงก์แนะนำ</div>:null}<div className="admin-content">{children}</div></main></div>;
}
