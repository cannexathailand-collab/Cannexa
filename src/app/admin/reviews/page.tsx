import {approvers} from "@/lib/accounts";
import {requireAdminPage} from "@/lib/auth";
import {commissionDay} from "@/lib/commission-payment";
import {db} from "@/lib/db";

const day = new Intl.DateTimeFormat("th-TH", {dateStyle: "medium", timeZone: "Asia/Bangkok"});

const money = (satang: number) => (satang / 100).toLocaleString("th-TH", {
 style: "currency",
 currency: "THB",
});

export default async function Reviews() {
 await requireAdminPage(approvers);
 const rows = await db.commission.findMany({
  where: { OR: [
   {status: "Approved", conversion: {status: "VERIFIED_NEW_FRIEND"}},
   {status: "Paid"},
  ] },
  orderBy: [{conversion: {verifiedAt: {sort: "desc", nulls: "last"}}}, {conversion: {createdAt: "desc"}}],
  include: {conversion: {include: {affiliate: {include: {accounts: {where: {role: "employee"}, select: {username: true}, orderBy: {username: "asc"}}}}}}},
 });
 const groups = Map.groupBy(rows, row => row.conversion.affiliateId);

 return <>
  <h1>จ่ายค่าคอมมิชชัน</h1>
  {!groups.size && <p>ยังไม่มีรายการค่าคอมมิชชัน</p>}
  {Array.from(groups.values(), items => {
   const {id, name, code, accounts} = items[0].conversion.affiliate;
   const days = Map.groupBy(items, item => commissionDay(item.conversion.verifiedAt ?? item.conversion.createdAt));
   const total = (entries: typeof items) => money(entries.reduce((sum, item) => sum + item.amountSatang, 0));
   return <section className="card review" key={id}>
    <h2>{name} · {code}</h2>
    {!!accounts.length && <p>บัญชีพนักงาน {accounts.map(account => account.username).join(", ")}</p>}
    <div className="table-wrap"><table>
     <thead><tr><th>วันที่ได้ค่าคอม</th><th>ยังไม่ได้จ่าย</th><th>จ่ายแล้ว</th><th>บันทึกการจ่าย</th></tr></thead>
     <tbody>{Array.from(days, ([date, entries]) => {
      const pending = entries.filter(item => item.status === "Approved");
      return <tr key={date}>
       <td>{day.format(entries[0].conversion.verifiedAt ?? entries[0].conversion.createdAt)}</td>
       <td>{total(pending)}</td>
       <td>{total(entries.filter(item => item.status === "Paid"))}</td>
       <td>{pending.length > 0 && <form action="/api/admin/review" method="post">
        {pending.map(item => <input key={item.id} type="hidden" name="commissionId" value={item.id}/>)}
        <label>อ้างอิงการจ่าย<input name="reason" required minLength={20} maxLength={3000}/></label>
        <button name="action" value="paid-day">บันทึกว่าจ่ายแล้วทั้งวัน</button>
       </form>}</td>
      </tr>;
     })}</tbody>
    </table></div>
   </section>;
  })}
 </>;
}
