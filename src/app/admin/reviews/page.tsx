import {approvers} from "@/lib/accounts";
import {requireAdminPage} from "@/lib/auth";
import {commissionReport} from "@/lib/commission-report";
import {CommissionMonthSelect} from "@/app/commission-month-select";

const money = (satang: number) => (satang / 100).toLocaleString("th-TH", {
 style: "currency",
 currency: "THB",
});

export default async function Reviews({searchParams}: {searchParams: Promise<{month?: string}>}) {
 await requireAdminPage(approvers);
 const {affiliates, groups, month, months} = await commissionReport((await searchParams).month);

 return <>
  <div className="eyebrow">บัญชี · ค่าใช้จ่าย</div><h1>จ่ายค่าคอมมิชชัน</h1>
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
    <p>เพิ่มเพื่อน: รอจ่าย {total(pending.filter(item=>item.kind==="FRIEND"))} · จ่ายแล้ว {total(items.filter(item=>item.kind==="FRIEND"&&item.status==="Paid"))}</p>
    <p>ยอดขาย: รอจ่าย {total(pending.filter(item=>item.kind==="SALE"))} · จ่ายแล้ว {total(items.filter(item=>item.kind==="SALE"&&item.status==="Paid"))}</p>
    {pending.length > 0 && <form action="/api/admin/review" method="post">
     <input type="hidden" name="month" value={month}/>
     {pending.map(item => <input key={item.id} type="hidden" name="commissionId" value={item.id}/>)}
     <button name="action" value="paid-batch">บันทึกว่าจ่ายยอดค้างเดือนที่เลือกแล้ว</button>
    </form>}
   </section>;
  })}
 </>;
}
