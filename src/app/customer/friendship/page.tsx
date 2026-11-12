import {cookies} from 'next/headers';
import {friendRetryCookie,readFriendRetry} from '@/lib/customer-friend-gate';
import {lineSettings} from '@/lib/line-settings';
import {lineCustomerDestination} from '@/lib/line-customer-destination';
import {customerLanguage} from '@/lib/customer-language-server';
import '../portal.css';

export const dynamic='force-dynamic';
export default async function CustomerFriendship({searchParams}:{searchParams:Promise<{status?:string}>}){
 const [params,jar,connection]=await Promise.all([searchParams,cookies(),lineSettings()]);
 const pending=readFriendRetry(jar.get(friendRetryCookie)?.value??'');
 const {t}=await customerLanguage();
 return <main className="customer-portal"><section className="portal-welcome portal-login-card"><h1>{t('ยืนยันการเป็นเพื่อน LINE ร้าน')}</h1><p>{t(!pending?'ขั้นตอนยืนยันหมดอายุ กรุณาเข้าสู่ระบบใหม่':params.status==='not-friend'?'กรุณาเพิ่มเพื่อนหรือปลดบล็อก LINE ร้านก่อนสร้างสมาชิก':'ขณะนี้ยังตรวจสอบสถานะเพื่อนกับ LINE ไม่สำเร็จ กรุณาลองตรวจสอบอีกครั้ง')}</p><p>{t('ระบบยังไม่ได้สร้างรหัสลูกค้าใหม่ และจะดำเนินการต่อเมื่อยืนยันว่าเป็นเพื่อนแล้วเท่านั้น')}</p>{pending&&connection&&<a className="button secondary" href={lineCustomerDestination(connection.settings.basicId,false)} target="_blank" rel="noopener noreferrer">{t('เปิด LINE ร้าน')}</a>}<a className="button portal-line" href={pending?'/api/customer/login?retry=1':'/api/customer/login'}>{t(pending?'เพิ่มเพื่อนแล้ว ตรวจสอบอีกครั้ง':'เข้าสู่ระบบด้วย LINE')}</a></section></main>;
}
