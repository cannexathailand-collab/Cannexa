"use client";

export function CommissionMonthSelect({action, month, months}: {action: string; month: string; months: string[]}) {
 const label = new Intl.DateTimeFormat("th-TH", {month: "long", year: "numeric", timeZone: "Asia/Bangkok"});
 return <form action={action} method="get">
  <label>เดือนค่าคอมมิชชัน <select name="month" key={month} defaultValue={month} onChange={event => event.currentTarget.form?.requestSubmit()}>
   {months.map(value => <option key={value} value={value}>{label.format(new Date(value + "-01T00:00:00Z"))}</option>)}
  </select></label>
 </form>;
}
