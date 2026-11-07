import Link from 'next/link';
const items=[
 {key:'overview',href:'/my-performance',label:'ภาพรวม',short:'ภาพรวม',icon:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z'},
 {key:'monthly',href:'/my-performance/monthly',label:'สรุปผลงานรายเดือน',short:'รายเดือน',icon:'M4 3v18h17M8 16v-5m5 5V7m5 9V4'},
 {key:'orders',href:'/my-performance/orders',label:'ออเดอร์จาก LINE',short:'ออเดอร์',icon:'m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7.5 5l9 4'},
 {key:'tasks',href:'/my-performance/tasks',label:'งานค้าง',short:'งานค้าง',icon:'M9 6h12M9 12h12M9 18h8M3 5l1 1 2-2M3 11l1 1 2-2M3 17l1 1 2-2'},
 {key:'prepare',href:'/my-performance/prepare',label:'สรุปยอดส่งงาน',short:'ส่งงาน',icon:'M9 4H5v17h14V4h-4M9 3h6v4H9V3Zm-1 9h8m-8 4h5'},
] as const;
export function EmployeeNav({active}:{active:'overview'|'monthly'|'orders'|'tasks'|'prepare'}){
 return <nav className="employee-nav" aria-label="เมนูผลงานพนักงาน">
  {items.map(item=><Link key={item.key} href={item.href} aria-label={item.label} aria-current={active===item.key?'page':undefined}>
   <svg className="employee-nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>
   <span className="employee-nav-full">{item.label}</span><span className="employee-nav-short">{item.short}</span>
  </Link>)}
 </nav>;
}
