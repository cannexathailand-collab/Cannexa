import Link from 'next/link';
export function EmployeeNav({active}:{active:'overview'|'monthly'|'orders'|'tasks'|'prepare'}){
 return <nav className="employee-nav" aria-label="เมนูผลงานพนักงาน">
  <Link href="/my-performance" aria-current={active==='overview'?'page':undefined}>ภาพรวม</Link>
  <Link href="/my-performance/monthly" aria-label="สรุปผลงานรายเดือน" aria-current={active==='monthly'?'page':undefined}><span className="employee-nav-full">สรุปผลงานรายเดือน</span><span className="employee-nav-short">รายเดือน</span></Link>
  <Link href="/my-performance/orders" aria-label="ออเดอร์จาก LINE" aria-current={active==='orders'?'page':undefined}><span className="employee-nav-full">ออเดอร์จาก LINE</span><span className="employee-nav-short">ออเดอร์ LINE</span></Link>
  <Link href="/my-performance/tasks" aria-current={active==='tasks'?'page':undefined}>งานค้าง</Link>
  <Link href="/my-performance/prepare" aria-label="สรุปยอดส่งงาน" aria-current={active==='prepare'?'page':undefined}><span className="employee-nav-full">สรุปยอดส่งงาน</span><span className="employee-nav-short">ส่งงาน</span></Link>
 </nav>;
}
