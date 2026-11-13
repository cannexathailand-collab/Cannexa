'use client';
import {useEmployeeLanguage} from '@/app/my-performance/language';
import {useRef} from 'react';

type Employee={username:string;affiliate:{name:string}|null};
export function EmployeeViewForm({employees,selected}:{employees:Employee[];selected:string}){
 const {t,locale}=useEmployeeLanguage();

 const returnTo=useRef<HTMLInputElement>(null);
 return <form action="/api/admin/employee-view" method="post" autoComplete="off" onSubmit={()=>{if(returnTo.current)returnTo.current.value=window.location.pathname+window.location.search;}}>
  <input ref={returnTo} type="hidden" name="returnTo" defaultValue="/my-performance"/>
  <label>{t("เลือกพนักงาน")}<select name="username" aria-label={t("เลือกพนักงาน")} defaultValue={selected} autoComplete="off" onChange={event=>event.currentTarget.form?.requestSubmit()}><option value="">{t("เลือกรายชื่อพนักงาน")}</option>{employees.map(employee=><option value={employee.username} key={employee.username}>{employee.username}{employee.affiliate?' · '+employee.affiliate.name:''}</option>)}</select></label>
  <button>{t("เปิดดู")}</button>
 </form>;
}
