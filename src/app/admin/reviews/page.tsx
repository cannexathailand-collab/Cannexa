import {approvers} from "@/lib/accounts";
import {requireAdminPage} from "@/lib/auth";
import {commissionReport} from "@/lib/commission-report";
import {CommissionMonthSelect} from "@/app/commission-month-select";
import '@/app/affiliate-performance.css';
import {SpecialCommissionButton} from '@/app/special-commission-button';
import {randomUUID} from 'node:crypto';
import {bangkokDay} from '@/lib/sales-dates';

const money = (satang: number) => (satang / 100).toLocaleString("th-TH", {
 style: "currency",
 currency: "THB",
});

export default async function Reviews({searchParams}: {searchParams: Promise<{month?: string;specialPaid?:string}>}) {
 await requireAdminPage(approvers);
 const params=await searchParams;
 const {affiliates, groups, month, months} = await commissionReport(params.month);

 return <>
  <div className="eyebrow">บัญชี · ค่าใช้จ่าย</div><h1>จ่ายค่าคอมมิชชัน</h1>
  {params.specialPaid==='1'&&<p className="notice live">บันทึกจ่ายค่าคอมพิเศษแล้ว รวมในรายงานของเดือนที่จ่าย</p>}
  <CommissionMonthSelect action="/admin/reviews" month={month} months={months}/>
  <a className="button secondary" href={"/api/admin/review/export?month="+month}>ส่งออก CSV</a>
  {!affiliates.length && <p>ยังไม่มี Affiliate</p>}
  {affiliates.map(({id, name, code, accounts}) => {
   const items = groups.get(id) ?? [];
   const pending = items.filter(item => item.status === "Approved");
   const total = (entries: typeof items) => money(entries.reduce((sum, item) => sum + item.amountSatang, 0));
   return <section className="card review" key={id} style={pending.some(item=>item.amountSatang>0)?{background:"#ecfdf5",borderLeft:"4px solid #34d399",color:"#065f46"}:undefined}>
    <h2>{name} · {code}</h2>
    {!!accounts.length && <p>บัญชีพนักงาน {accounts.map(account => account.username).join(", ")}</p>}
    <p>ยังไม่ได้จ่าย <strong>{total(pending)}</strong> · จ่ายแล้วสะสม <strong>{total(items.filter(item => item.status === "Paid"))}</strong></p>
    <div className="commission-breakdown">
     <div><h3>ค่าคอมเพิ่มเพื่อน</h3><span>รอจ่าย <strong>{total(pending.filter(item=>item.kind==="FRIEND"))}</strong></span><small>จ่ายแล้ว {total(items.filter(item=>item.kind==="FRIEND"&&item.status==="Paid"))}</small></div>
     <div><h3>ค่าคอมยอดขาย</h3><span>รอจ่าย <strong>{total(pending.filter(item=>item.kind==="SALE"))}</strong></span><small>จ่ายแล้ว {total(items.filter(item=>item.kind==="SALE"&&item.status==="Paid"))}</small></div>
     <div className="commission-special"><h3>ค่าคอมพิเศษ</h3><span>จ่ายแล้ว <strong>{total(items.filter(item=>item.kind==='SPECIAL'))}</strong></span><small>บันทึกเพิ่มตามจำนวนเงินที่จ่ายจริง</small><SpecialCommissionButton affiliateId={id} name={name} requestKey={randomUUID()} today={bangkokDay(new Date())}/></div>
    </div>
    {!!items.filter(item=>item.kind==='SPECIAL').length&&<details><summary>ประวัติค่าคอมพิเศษเดือนนี้</summary>{items.filter(item=>item.kind==='SPECIAL').map(item=><p key={item.id}>{item.conversion.verifiedAt?.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'})} · {item.description} · {money(item.amountSatang)}</p>)}</details>}
    {pending.length > 0 && <form action="/api/admin/review" method="post">
     <input type="hidden" name="month" value={month}/>
     {pending.map(item => <input key={item.id} type="hidden" name="commissionId" value={item.id}/>)}
     <button name="action" value="paid-batch">บันทึกว่าจ่ายยอดค้างเดือนที่เลือกแล้ว</button>
    </form>}
   </section>;
  })}
 </>;
}
