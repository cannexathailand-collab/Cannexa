'use client';
import {useState} from 'react';
import {PopupDetails} from '@/app/popup-details';
import {CustomerLineLink} from './prepare/customer-line-link';
import {useEmployeeLanguage} from './language';

export function OrderCustomerLineLink({code}:{code:string|null}){
 const {t}=useEmployeeLanguage();
 const [active,setActive]=useState(false);
 if(!code)return <button className="secondary" disabled title={t('ยังไม่มีรหัสลูกค้า')}>{t('ลิงก์ผูก LINE')}</button>;
 return <PopupDetails className="compact-order-action" summary={t('ลิงก์ผูก LINE')} title={t('ผูก LINE ของลูกค้า')+' · '+code} closeLabel={t('ปิด')} onOpen={()=>setActive(true)} onClose={()=>setActive(false)}>
  {active&&<CustomerLineLink key={code} code={code} active/>}
 </PopupDetails>;
}
