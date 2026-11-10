import {StoreBrand} from '@/app/store-brand';
import Link from 'next/link';
import {SidebarNavigation} from '@/app/sidebar-navigation';
import '@/app/sidebar.css';
import './platform-layout.css';

export default function PlatformLayout({children}:{children:React.ReactNode}){
 return <div className="shell"><aside className="sidebar"><Link className="brand" href="/platform/customers"><StoreBrand/> · ผู้ดูแลแพลตฟอร์ม</Link><SidebarNavigation mobileLinks={[{href:'/platform/customers',label:'ลูกค้า',icon:'customers'},{href:'/platform',label:'ร้านค้า',icon:'home'}]}><Link href="/platform/customers">แดชบอร์ดลูกค้าทุกร้าน</Link><Link href="/platform">จัดการร้านค้า</Link><Link href="/admin/executive">กลับร้านหลัก</Link></SidebarNavigation></aside><div className="platform-content">{children}</div></div>;
}
