import {notFound} from 'next/navigation';
import {activeShop,shopPath} from '@/lib/shop-session';

export default async function ShopLogin({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{error?:string}>}){
 const {slug}=await params,shop=await activeShop(slug);
 if(!shop)notFound();
 const {error}=await searchParams;
 return <main className="center-page"><div className="customer"><h1>เข้าสู่ระบบ {shop.name}</h1><p className="muted">ใช้บัญชีที่ร้านนี้สร้างให้คุณ</p>{error&&<p role="alert">ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับ</p>}<form action={shopPath(slug)+'/session'} method="post"><label>ชื่อผู้ใช้<input name="username" required maxLength={64} autoComplete="username"/></label><label>รหัสผ่าน<input name="password" type="password" required maxLength={256} autoComplete="current-password"/></label><button>เข้าสู่ร้าน</button></form></div></main>;
}
