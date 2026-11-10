import "./globals.css";
import "./workspace-ui.css";
import "./popup-details.css";
import "./financial-tones.css";
import "./mobile-app.css";
import type {Metadata} from "next";
import {Suspense} from "react";
import {LiveUpdates} from "./live-updates";
import {StoreBrandProvider} from './store-brand';
import {documentBrandingSnapshot} from '@/lib/document-branding';
import './store-brand.css';
export const metadata:Metadata={title:"LINE OA Affiliate Tracking",description:"ระบบติดตาม Affiliate และตรวจสอบหลักฐานก่อนอนุมัติค่าคอมมิชชัน"};
export default async function Layout({children}:{children:React.ReactNode}){const brand=await documentBrandingSnapshot().catch(()=>null);return <html lang="th"><body><StoreBrandProvider brand={brand}><Suspense fallback={null}><LiveUpdates/></Suspense>{children}</StoreBrandProvider></body></html>;}
