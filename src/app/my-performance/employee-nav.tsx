import Link from 'next/link';
const items=[
 {key:'overview',href:'/my-performance',label:'ภาพรวม',short:'ภาพรวม',icon:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z'},
 {key:'today',href:'/my-performance/today',label:'ออเดอร์วันนี้',short:'วันนี้',icon:'M4 5h16v16H4V5Zm4-2v4m8-4v4M4 10h16m-11 4h6'},
 {key:'monthly',href:'/my-performance/monthly',label:'สรุปผลงานรายเดือน',short:'รายเดือน',icon:'M4 3v18h17M8 16v-5m5 5V7m5 9V4'},
 {key:'orders',href:'/my-performance/orders',label:'รายการออเดอร์',short:'ออเดอร์',icon:'m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7.5 5l9 4'},
 {key:'stock',href:'/my-performance/stock',label:'สต๊อกสินค้า',short:'สต๊อก',icon:'M3 7h18v14H3V7Zm-1-4h20v4H2V3Zm7 9h6'},
 {key:'prepare',href:'/my-performance/prepare',label:'สรุปยอดส่งงาน',short:'ส่งงาน',icon:'M9 4H5v17h14V4h-4M9 3h6v4H9V3Zm-1 9h8m-8 4h5'},
] as const;
export function EmployeeNav({active}:{active:'overview'|'today'|'monthly'|'orders'|'tasks'|'prepare'|'stock'}){
 return <nav className="employee-nav" aria-label="เมนูผลงานพนักงาน">
  {items.map(item=><Link key={item.key} href={item.href} aria-label={item.label} aria-current={active===item.key?'page':undefined}>
   <svg className="employee-nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>
   <span className="employee-nav-full">{item.label}</span><span className="employee-nav-short">{item.short}</span>
  </Link>)}
 </nav>;
}
