"use client";

export function CommissionMonthSelect({action, month, months, label:fieldLabel="เดือนค่าคอมมิชชัน",locale="th-TH"}: {action: string; month: string; months: string[];label?:string;locale?:string}) {
 const label = new Intl.DateTimeFormat(locale, {month: "long", year: "numeric", timeZone: "Asia/Bangkok"});
 return <form action={action} method="get">
  <label>{fieldLabel} <select name="month" key={month} defaultValue={month} onChange={event => event.currentTarget.form?.requestSubmit()}>
   {months.map(value => <option key={value} value={value}>{label.format(new Date(value + "-01T00:00:00Z"))}</option>)}
  </select></label>
 </form>;
}
