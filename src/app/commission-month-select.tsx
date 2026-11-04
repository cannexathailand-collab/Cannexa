export function CommissionMonthSelect({month, months}: {month: string; months: string[]}) {
 const label = new Intl.DateTimeFormat("th-TH", {month: "long", year: "numeric", timeZone: "Asia/Bangkok"});
 return <form method="get">
  <label>เดือนค่าคอมมิชชัน <select name="month" defaultValue={month}>
   {months.map(value => <option key={value} value={value}>{label.format(new Date(value + "-01T00:00:00Z"))}</option>)}
  </select></label>
  <button type="submit">ดูยอด</button>
 </form>;
}
