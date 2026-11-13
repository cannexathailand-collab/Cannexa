import {customerLanguage} from '@/lib/customer-language-server';
import {PublicLanguageSwitch} from '@/app/public-language-switch';
import {StoreBrand} from '@/app/store-brand';
import {notFound} from 'next/navigation';
import {activeShop,shopPath} from '@/lib/shop-session';

export default async function ShopLogin({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{error?:string}>}){
 const {slug}=await params,shop=await activeShop(slug);
 if(!shop)notFound();
 const {error}=await searchParams,{language}=await customerLanguage(),en=language==='en';
 return <main className="center-page" lang={language}><div className="customer"><PublicLanguageSwitch language={language}/><div className="brand"><StoreBrand fallback={shop.name}/></div><h1>{en?'Shop sign in':'เข้าสู่ระบบร้านค้า'}</h1><p className="muted">{en?'Use the account provided by this shop.':'ใช้บัญชีที่ร้านนี้สร้างให้คุณ'}</p>{error&&<p role="alert">{en?'Incorrect username or password, or the account is inactive.':'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับ'}</p>}<form action={shopPath(slug)+'/session'} method="post"><label>{en?'Username':'ชื่อผู้ใช้'}<input name="username" required maxLength={64} autoComplete="username"/></label><label>{en?'Password':'รหัสผ่าน'}<input name="password" type="password" required maxLength={256} autoComplete="current-password"/></label><button>{en?'Sign in':'เข้าสู่ร้าน'}</button></form></div></main>;
}
