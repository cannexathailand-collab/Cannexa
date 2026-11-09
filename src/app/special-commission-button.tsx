'use client';
import {useRef,useState} from 'react';
export function SpecialCommissionButton({affiliateId,name,requestKey,today}:{affiliateId:string;name:string;requestKey:string;today:string}){
 const dialog=useRef<HTMLDialogElement>(null),[amount,setAmount]=useState('');
 return <><button type="button" className="special-pay-button" onClick={()=>dialog.current?.showModal()}>＋ จ่ายค่าคอมพิเศษ</button>
 <dialog ref={dialog} className="special-payment-dialog"><div className="special-dialog-heading"><div><span className="eyebrow">ค่าคอมพิเศษ</span><h2>บันทึกการจ่ายให้ {name}</h2></div><button type="button" className="secondary" aria-label="ปิดหน้าต่างค่าคอมพิเศษ" onClick={()=>dialog.current?.close()}>×</button></div>
 <p className="muted">ใช้บันทึกเงินที่จ่ายให้ Affiliate แล้ว พร้อมเก็บไว้ในรายงานและประวัติ</p>
 <form action="/api/admin/review/special" method="post"><input type="hidden" name="affiliateId" value={affiliateId}/><input type="hidden" name="requestKey" value={requestKey}/>
 <div className="special-payment-fields"><label>จำนวนเงิน (บาท)<input name="amount" type="number" min="0.01" max="21474836.47" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></label><label>วันที่จ่าย<input name="day" type="date" required min="2000-01-01" max={today} defaultValue={today}/></label></div>
 <label>เหตุผล / หมายเหตุ<textarea name="reason" required maxLength={500} rows={3} placeholder="เช่น โบนัสผลงานประจำเดือน"/></label>
 <div className="special-payment-total tone-expense"><span>ยอดที่จะบันทึก</span><strong>฿{Math.max(0,Number(amount)||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>
 <label className="special-confirm"><input name="confirmed" type="checkbox" value="paid" required/> ยืนยันว่าจ่ายเงินจำนวนนี้ให้ {name} แล้ว</label>
 <div className="special-dialog-actions"><button type="button" className="secondary" onClick={()=>dialog.current?.close()}>ยกเลิก</button><button type="submit">ยืนยันบันทึกจ่ายแล้ว</button></div></form></dialog></>;
}
