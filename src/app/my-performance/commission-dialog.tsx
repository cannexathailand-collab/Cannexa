'use client';
import {useEmployeeLanguage} from '@/app/my-performance/language';
import {useEffect,useRef,type ReactNode} from 'react';
export function CommissionDialog({children,autoOpen}:{children:ReactNode;autoOpen:boolean}){
 const {t,locale}=useEmployeeLanguage();

 const dialog=useRef<HTMLDialogElement>(null);
 const close=()=>{
  dialog.current?.close();
  const url=new URL(window.location.href);url.searchParams.delete('commissionOpen');url.hash='';window.history.replaceState(window.history.state,'',url);
 };
 useEffect(()=>{if(autoOpen&&new URL(window.location.href).searchParams.get('commissionOpen')==='1'&&!dialog.current?.open)dialog.current?.showModal();});
 return <>
  <div className="commission-detail-action"><button className="secondary" type="button" onClick={()=>dialog.current?.showModal()}>{t("ดูรายละเอียดค่าคอม")}</button><span>{t("ดูประวัติ แยกประเภท และสถานะการจ่าย")}</span></div>
  <dialog ref={dialog} className="commission-dialog" aria-labelledby="commission-dialog-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}}>
   <header><div><h2 id="commission-dialog-title">{t("รายละเอียดค่าคอม")}</h2><p>{t("ประวัติค่าคอมของคุณ")}</p></div><button type="button" className="secondary" onClick={close} aria-label={t("ปิดรายละเอียดค่าคอม")}>{t("ปิด ×")}</button></header>
   <div className="commission-dialog-body">{children}</div>
  </dialog>
 </>;
}
