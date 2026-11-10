import {StoreBrand} from '@/app/store-brand';
import Link from "next/link";
import {home} from "@/lib/accounts";
import {requireAccount} from "@/lib/auth";
export default async function Password({searchParams}:{searchParams:Promise<{error?:string}>}){
 const a=await requireAccount();
 const {error}=await searchParams;
 return <main className="center-page"><section className="customer"><div className="brand"><StoreBrand/></div><h1>เปลี่ยนรหัสผ่าน</h1>
 {error&&<p role="alert">เปลี่ยนไม่ได้ ตรวจรหัสเดิมและกรอกรหัสใหม่ให้ตรงกันอย่างน้อย 8 ตัวอักษร</p>}
 <form method="post" action="/api/account/password">
 <label>รหัสเดิม<input name="old" type="password" required maxLength={256} autoComplete="current-password"/></label>
 <label>รหัสใหม่<input name="password" type="password" required minLength={8} maxLength={256} autoComplete="new-password"/></label>
 <label>ยืนยันรหัสใหม่<input name="confirm" type="password" required minLength={8} maxLength={256} autoComplete="new-password"/></label>
 <button>บันทึกรหัสผ่านใหม่</button></form><Link href={home(a.role)}>กลับหน้าหลัก</Link></section></main>;
}
