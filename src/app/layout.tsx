import "./globals.css";
import "./workspace-ui.css";
import "./popup-details.css";
import "./financial-tones.css";
import "./mobile-app.css";
import type {Metadata} from "next";
import {Suspense} from "react";
import {LiveUpdates} from "./live-updates";
export const metadata:Metadata={title:"LINE OA Affiliate Tracking",description:"ระบบติดตาม Affiliate และตรวจสอบหลักฐานก่อนอนุมัติค่าคอมมิชชัน"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="th"><body><Suspense fallback={null}><LiveUpdates/></Suspense>{children}</body></html>;}
