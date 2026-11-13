import {employeeLanguage} from '@/lib/employee-language-server';
import Link from 'next/link';
import type {employeeOrderDashboard} from '@/lib/employee-order-dashboard';

export async function EmployeeOrderSummary({data,shared=false}:{data:Awaited<ReturnType<typeof employeeOrderDashboard>>;shared?:boolean}){
 const {t,locale,language}=await employeeLanguage();

 const allTime=data.range==='all';
 const href=(status?:string)=>'/my-performance/orders?'+new URLSearchParams({
  ...(data.mine?{scope:'mine'}:{}),...(allTime?{range:'all'}:{page:String(data.page)}),
  ...(data.query&&!status?{q:data.query}:{}),...(status?{status}:{}),
 });
 const money=(value:number)=>(value/100).toLocaleString(locale,{style:'currency',currency:'THB'});
 return <section className="employee-order-dashboard" aria-label={t("สรุปรายการออเดอร์")}>
  <h2>{data.query?t('ผลการค้นหาทั้งระบบ'):shared?t('ออเดอร์รวมของร้าน'):t('ออเดอร์ของฉัน')}</h2>
  <p className="small muted">{allTime?t('ข้อมูลทุกช่วงวันที่')+(data.query?t(' · ค้นหา “')+data.query+'”':''):t('รอบวันที่ ')+data.currentRound+t(' · เวลาตัดรอบ ')+data.closeTime+t(' น.')}</p>
  <div className="commission-summary-grid employee-order-dashboard-grid">
   <Link className="commission-metric tone-income" href="/my-performance/orders" aria-current={!allTime&&!data.mine?'page':undefined}><span>{!allTime&&data.page>1?t('ออเดอร์ในรอบ'):t('ออเดอร์วันนี้')}</span><strong>{allTime?t('ดูวันนี้'):data.allCount}<em>{allTime?'':t(' รายการ')}</em></strong><small>{t("ดูตามรอบวันที่ →")}</small></Link>
   <Link className="commission-metric tone-income" href="/my-performance/orders?range=all" aria-current={allTime&&!data.mine?'page':undefined}><span>{t("ออเดอร์ทั้งหมดในระบบ")}</span><strong>{data.systemCount} <em>{t("รายการ")}</em></strong><small>{t("ทุกคน · ทุกช่วงวันที่ →")}</small></Link>
   <Link className="commission-metric tone-income" href="/my-performance/orders?range=all&scope=mine" aria-current={data.mine?'page':undefined}><span>{t("ออเดอร์ของฉัน")}</span><strong>{data.mySystemCount} <em>{t("รายการ")}</em></strong><small>{t("เฉพาะของฉัน · ทุกช่วงวันที่ →")}</small></Link>
   <Link className="commission-metric tone-income" href={href()}><span>{data.query?t('ยอดออเดอร์ที่พบ'):allTime?t('ยอดขายทุกช่วงวันที่'):data.page===1?t('ยอดขายวันนี้'):t('ยอดขายในรอบ')}</span><strong>{money(data.todayAmount)}</strong><small>{t("ยอดโอนและ COD ตามมุมมองที่เลือก")}</small></Link>
   {([{key:'WAITING',label:'รอจัดส่ง'},{key:'SHIPPED',label:'จัดส่งแล้ว'},{key:'RETURNED',label:'ตีกลับ / จัดส่งไม่สำเร็จ'},{key:'REVIEW',label:'ต้องตรวจสอบ'}] as const).map(item=><Link className={'commission-metric'+(item.key==='REVIEW'||item.key==='RETURNED'?' employee-order-warning':'')} key={item.key} href={href(item.key)}><span>{t(item.label)}</span><strong>{data.counts[item.key]} <em>{t("รายการ")}</em></strong><small>{t("ดูรายการ →")}</small></Link>)}
  </div>
 </section>;
}
