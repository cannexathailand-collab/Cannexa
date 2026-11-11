import {CopyOrderShipping} from '@/app/copy-order-shipping';
import type {CustomerLanguage} from '@/lib/customer-language';

export function CustomerParcelTracking({tracking,language='th'}:{tracking?:string|null;language?:CustomerLanguage}){
 const number=tracking?.trim();
 if(!number)return null;
 return <>
  <CopyOrderShipping text={number} language={language} label={language==='en'?'Copy tracking number':'คัดลอกเลขพัสดุ'} successMessage={language==='en'?'Tracking number copied':'คัดลอกเลขพัสดุแล้ว'}/>
  <a className="button secondary" href="https://track.thailandpost.co.th/" target="_blank" rel="noopener noreferrer">{language==='en'?'Track parcel':'เช็กเลขพัสดุ'}</a>
 </>;
}
