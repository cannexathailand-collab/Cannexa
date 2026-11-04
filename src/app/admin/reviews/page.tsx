import {approvers} from "@/lib/accounts";
import {requireAdminPage} from "@/lib/auth";
import {commissionPeriod} from "@/lib/commission-month";
import {CommissionMonthSelect} from "@/app/commission-month-select";
import {db} from "@/lib/db";

const money = (satang: number) => (satang / 100).toLocaleString("th-TH", {
 style: "currency",
 currency: "THB",
});

export default async function Reviews({searchParams}: {searchParams: Promise<{month?: string}>}) {
 await requireAdminPage(approvers);
 const [affiliates, rows] = await Promise.all([db.affiliate.findMany({
  orderBy: {name: "asc"},
  include: {accounts: {where: {role: "employee"}, select: {username: true}, orderBy: {username: "asc"}}},
 }), db.commission.findMany({
  where: { OR: [
   {status: "Approved", conversion: {status: "VERIFIED_NEW_FRIEND"}},
   {status: "Paid"},
  ] },
  orderBy: [{conversion: {verifiedAt: {sort: "desc", nulls: "last"}}}, {conversion: {createdAt: "desc"}}],
  include: {conversion: {select: {affiliateId: true, verifiedAt: true, createdAt: true}}},
 })]);
 const {month, months, entries} = commissionPeriod(rows, (await searchParams).month);
 const groups = Map.groupBy(entries, row => row.conversion.affiliateId);

 return <>
  <h1>จ่ายค่าคอมมิชชัน</h1>
  <CommissionMonthSelect month={month} months={months}/>
  {!affiliates.length && <p>ยังไม่มี Affiliate</p>}
  {affiliates.map(({id, name, code, accounts}) => {
   const items = groups.get(id) ?? [];
   const pending = items.filter(item => item.status === "Approved");
   const total = (entries: typeof items) => money(entries.reduce((sum, item) => sum + item.amountSatang, 0));
   return <section className="card review" key={id}>
    <h2>{name} · {code}</h2>
    {!!accounts.length && <p>บัญชีพนักงาน {accounts.map(account => account.username).join(", ")}</p>}
    <p>ยังไม่ได้จ่าย <strong>{total(pending)}</strong> · จ่ายแล้วสะสม <strong>{total(items.filter(item => item.status === "Paid"))}</strong></p>
    {pending.length > 0 && <form action="/api/admin/review" method="post">
     <input type="hidden" name="month" value={month}/>
     {pending.map(item => <input key={item.id} type="hidden" name="commissionId" value={item.id}/>)}
     <label>อ้างอิงการจ่าย<input name="reason" required minLength={20} maxLength={3000}/></label>
     <button name="action" value="paid-batch">บันทึกว่าจ่ายยอดค้างเดือนที่เลือกแล้ว</button>
    </form>}
   </section>;
  })}
 </>;
}
