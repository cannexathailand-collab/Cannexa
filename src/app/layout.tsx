import "./globals.css";
import type {Metadata} from "next";
export const metadata:Metadata={title:"LINE OA Affiliate Tracking",description:"ระบบติดตาม Affiliate และตรวจสอบหลักฐานก่อนอนุมัติค่าคอมมิชชัน"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="th"><body>{children}</body></html>;}
