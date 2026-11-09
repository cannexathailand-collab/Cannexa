import type {EmployeeCommission} from '@/lib/employee-commissions';
import {PopupDetails} from '@/app/popup-details';
const statusLabels={PAID:'จ่ายค่าคอมแล้ว',PENDING:'รอจ่ายค่าคอม',WAITING:'รอคำนวณ / ตรวจสอบค่าคอม'};
const money=(value:number)=>(value/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
export function OrderCommissionStatus({visible,payment,codReceived,rows}:{visible:boolean;payment:string|null;codReceived:boolean;rows:EmployeeCommission[]}){
 if(!visible)return null;
 return <section className="order-commission-status" aria-label="สถานะค่าคอมของฉัน">
  {payment==='COD'&&<p className={codReceived?'commission-paid':'commission-cod-waiting'}>{codReceived?'COD รับเงินแล้ว':'COD ยังไม่ได้รับเงิน'}</p>}
  {rows.length?rows.map(row=><p key={row.id} className={'commission-'+row.status.toLowerCase()}><strong>{statusLabels[row.status]}</strong>{row.amount!==null&&<> · {money(row.amount)}</>}{row.paidAt&&<> · {row.paidAt.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'})}</>}</p>):<p className="commission-waiting">ค่าคอมยังไม่พร้อมคำนวณ</p>}
  {rows.length>0&&<PopupDetails summary="ดูรายละเอียดค่าคอม" title="ค่าคอมของออเดอร์นี้">{rows.map(row=><section key={row.id}><h3>{statusLabels[row.status]}</h3><p>{row.amount===null?'รอคำนวณยอด':money(row.amount)}</p><p>{row.note}</p>{row.paidAt&&<p>จ่ายเมื่อ {row.paidAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p>}</section>)}</PopupDetails>}
 </section>;
}

export function orderCommissionCopyLines({visible,payment,codReceived,rows}:{visible:boolean;payment:string|null;codReceived:boolean;rows:EmployeeCommission[]}){
 if(!visible)return [];
 return [
  ...(payment==='COD'?[codReceived?'COD รับเงินแล้ว':'COD ยังไม่ได้รับเงิน']:[]),
  ...(rows.length?rows.map(row=>statusLabels[row.status]+(row.amount===null?'':' · '+money(row.amount))+(row.paidAt?' · จ่ายเมื่อ '+row.paidAt.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'}):'')) : ['ค่าคอมยังไม่พร้อมคำนวณ']),
 ];
}
