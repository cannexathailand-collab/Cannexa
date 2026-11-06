import Link from 'next/link';
export function EmployeeNav({active}:{active:'overview'|'monthly'|'orders'}){
 return <nav className="employee-nav" aria-label="เมนูผลงานพนักงาน">
  <Link href="/my-performance" aria-current={active==='overview'?'page':undefined}>ภาพรวม</Link>
  <Link href="/my-performance/monthly" aria-label="สรุปผลงานรายเดือน" aria-current={active==='monthly'?'page':undefined}><span className="employee-nav-full">สรุปผลงานรายเดือน</span><span className="employee-nav-short">รายเดือน</span></Link>
  <Link href="/my-performance/orders" aria-label="ออเดอร์จาก LINE" aria-current={active==='orders'?'page':undefined}><span className="employee-nav-full">ออเดอร์จาก LINE</span><span className="employee-nav-short">ออเดอร์ LINE</span></Link>
 </nav>;
}
