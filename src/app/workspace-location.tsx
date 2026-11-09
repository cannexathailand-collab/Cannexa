'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
const pages:Record<string,[string,string]>={'/admin':['Affiliate','ภาพรวม Affiliate'],'/admin/affiliates':['Affiliate','ตั้งค่า Affiliate'],'/admin/users':['ระบบ','จัดการผู้ใช้'],'/admin/customers':['CRM','รหัสลูกค้า'],'/admin/crm':['CRM','ข้อมูลลูกค้า'],'/admin/crm/tiers':['CRM','Member'],'/admin/crm/points':['CRM','ตั้งค่า Green Coin'],'/admin/accounting':['บัญชี','บัญชีสรุป'],'/admin/accounting/daily':['บัญชี','บัญชีรายวัน'],'/admin/sales':['บัญชี','ยอดขาย'],'/admin/expenses':['บัญชี','ค่าใช้จ่าย'],'/admin/reviews':['บัญชี','จ่ายค่าคอมมิชชัน'],'/admin/stock':['สต๊อก','รายการสินค้า'],'/admin/stock/history':['สต๊อก','รายการย้อนหลัง'],'/admin/stock/review':['สต๊อก','รอตรวจสอบ'],'/admin/orders':['เชื่อมต่อ LINE','ตั้งค่าบอทรับออเดอร์'],'/admin/orders/list':['ออเดอร์','รายการออเดอร์'],'/admin/line':['การเชื่อมต่อ','LINE'],'/admin/meta':['การเชื่อมต่อ','Meta Pixel'],'/admin/gmail':['การเชื่อมต่อ','Gmail'],'/admin/audit':['ระบบ','ประวัติการดำเนินการ']};
pages['/admin/orders/prepare']=['ออเดอร์','สรุปยอดส่งงาน'];
pages['/admin/orders/website']=['ออเดอร์','ออเดอร์จากเว็บไซต์'];
pages['/admin/orders/upload']=['ออเดอร์','อัปโหลดรายการจัดส่ง'];
pages['/admin/orders/create']=['ออเดอร์','สร้างออเดอร์'];
pages['/admin/orders/payment']=['ออเดอร์','ตั้งค่าการชำระเงิน'];
pages['/admin/crm/customer-entry']=['CRM','ลูกค้า'];
export function WorkspaceLocation(){const path=usePathname(),parts=pages[path]??(path.startsWith('/admin/crm/')?['CRM','รายละเอียดลูกค้า']:path.startsWith('/admin/orders/list/')?['ออเดอร์','รายละเอียดออเดอร์']:path.startsWith('/admin/orders/')?['ออเดอร์','ตรวจสอบออเดอร์']:['Workspace','หน้าปัจจุบัน']);return <nav className="workspace-location" aria-label="ตำแหน่งหน้า"><Link href="/admin">หน้าหลัก</Link><span aria-hidden="true">/</span><span>{parts[0]}</span><span aria-hidden="true">/</span><strong>{parts[1]}</strong></nav>;}
