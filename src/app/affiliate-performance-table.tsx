'use client';
import {Fragment,useState} from 'react';
import type {AffiliatePerformance} from '@/lib/affiliate-performance';
import {salesCommissionBasisLabel} from '@/lib/sales-commission-rate';
const money=(n:number)=>'฿'+(n/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
export function AffiliatePerformanceTable({rows}:{rows:AffiliatePerformance[]}){
 const [view,setView]=useState('sales'),[open,setOpen]=useState<string|null>(null);
 return <section className="card affiliate-performance">
  <header><div><h2>ผลงาน Affiliate</h2><p>ยอดขายและค่าคอมของแต่ละคนในช่วงที่เลือก</p></div><a className="button secondary" href="/admin/affiliates">ตั้งค่า Affiliate ↗</a></header>
  <div className="affiliate-tabs" role="group" aria-label="มุมมองผลงาน Affiliate">
   <button type="button" aria-pressed={view==='sales'} onClick={()=>setView('sales')}>ยอดขายและค่าคอม</button>
   <button type="button" aria-pressed={view==='referrals'} onClick={()=>setView('referrals')}>การแนะนำลูกค้า</button>
  </div>
  <div className="table-wrap"><table><thead><tr><th>ชื่อ / รหัส</th>
   {view==='sales'?<><th>ยอดจากการแนะนำ</th><th>ยอดที่ปิดการขาย</th><th>เพื่อนใหม่</th><th>ค่าคอมรวม</th></>:<><th>คลิกลิงก์</th><th>LINE Login</th><th>เพื่อนใหม่</th><th>ค่าคอมเพิ่มเพื่อน</th></>}
   <th>ค่าคอมพิเศษ</th><th>รายละเอียด</th>
  </tr></thead><tbody>{rows.map(r=><Fragment key={r.id}>
   <tr className={open===r.id?'is-expanded':''}><td><strong>{r.name}</strong><small>{r.code}</small></td>
    {view==='sales'?<><td>{money(r.referredRevenueSatang)}<small>{r.referredCount} ออเดอร์</small></td><td>{money(r.closedRevenueSatang)}<small>{r.closedCount} ออเดอร์</small></td><td>{r.approved} คน</td><td className="affiliate-total">{money(r.totalCommissionSatang)}</td></>:<><td>{r.clicks}</td><td>{r.logins}</td><td>{r.approved}</td><td>{money(r.commissionSatang)}</td></>}
    <td>{money(r.specialCommissionSatang)}<small>จ่ายแล้ว</small></td>
    <td><button type="button" className="affiliate-detail-button" aria-expanded={open===r.id} aria-controls={'affiliate-details-'+r.id} aria-label={(open===r.id?'ปิด':'ดู')+'รายละเอียด '+r.name} onClick={()=>setOpen(open===r.id?null:r.id)}>{open===r.id?'ปิด ↑':'ดูเพิ่ม ↓'}</button></td>
   </tr>
   {open===r.id&&<tr id={'affiliate-details-'+r.id}><td colSpan={7} className="affiliate-detail-cell"><div className="affiliate-detail-grid">
    <section><h3>การแนะนำลูกค้า</h3><dl>
     <div><dt>คลิกลิงก์ / ล็อกอิน</dt><dd>{r.clicks} / {r.logins}</dd></div>
     <div><dt>เพื่อนใหม่ยืนยันแล้ว</dt><dd>{r.approved} คน</dd></div>
     <div><dt>รอตรวจสอบ / ไม่นับค่าคอม</dt><dd>{r.pending} / {r.rejected}</dd></div>
     <div><dt>ลูกค้าที่แนะนำและซื้อสำเร็จ</dt><dd>{r.referredCustomers} คน</dd></div>
    </dl></section>
    <section><h3>ค่าคอมมิชชัน</h3><dl>
     <div><dt>เพิ่มเพื่อน</dt><dd>{money(r.commissionSatang)}</dd></div>
     <div><dt>ยอดขาย</dt><dd>{money(r.pendingSalesSatang+r.paidSalesSatang)}</dd></div>
     <div><dt>ค่าคอมพิเศษ</dt><dd>{money(r.specialCommissionSatang)}</dd></div>
     <div><dt>รวมรอจ่าย</dt><dd>{money(r.pendingCommissionSatang)}</dd></div>
     <div><dt>รวมจ่ายแล้ว</dt><dd>{money(r.paidCommissionSatang)}</dd></div>
     <div><dt>รายการรอต้นทุน</dt><dd>{r.waitingCost} รายการ</dd></div>
    </dl></section>
    <section><h3>อัตราที่ตั้งไว้ปัจจุบัน</h3>{r.rates&&<><dl>
     <div><dt>เพิ่มเพื่อน</dt><dd>{money(r.rates.rateSatang)} / คน</dd></div>
     <div><dt>โอน / COD</dt><dd>{((r.rates.salesCommissionTransferBps??r.rates.salesCommissionBps)/100).toLocaleString('th-TH')}% / {((r.rates.salesCommissionCodBps??r.rates.salesCommissionBps)/100).toLocaleString('th-TH')}%</dd></div>
    </dl><p>คิดจาก{salesCommissionBasisLabel(r.rates.salesCommissionBasis)}</p></>}<small>ค่าคอมจริงใช้อัตราที่บันทึกไว้กับแต่ละรายการ</small></section>
   </div></td></tr>}
  </Fragment>)}</tbody></table>{!rows.length&&<p className="empty">ยังไม่มีข้อมูล Affiliate ในช่วงนี้</p>}</div>
  <p className="affiliate-note">ยอดจากการแนะนำและยอดปิดการขายอาจเป็นออเดอร์เดียวกัน ไม่ใช้บวกเป็นยอดขายรวมร้าน · ยอดขายนับตามวันจัดส่งที่ยืนยันแล้ว ค่าคอมปกติตามวันที่บันทึกรายการ และค่าคอมพิเศษตามวันที่จ่าย</p>
 </section>;
}
