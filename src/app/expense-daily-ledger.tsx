import {ExpenseDetailsButton} from '@/app/expense-details-button';
import type {expenseReport} from '@/lib/expense-report';
import {dayStart} from '@/lib/sales-dates';

type DailyExpenses = Awaited<ReturnType<typeof expenseReport>>['daily'];
const amount = (value: number) => (value / 100).toLocaleString('th-TH', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export function ExpenseDailyLedger({days}: {days: DailyExpenses}) {
  return <section className="card">
    <h2>ค่าใช้จ่ายรายวัน</h2>
    <div className="table-wrap">
      <table className="expense-ledger financial-expense-table">
        <thead><tr>
          <th scope="col">วันที่</th>
          <th scope="col">รายการ</th>
          <th scope="col" className="numeric expense-count">จำนวนรายการ</th>
          <th scope="col" className="numeric">จำนวนเงิน (บาท)</th>
        </tr></thead>
        <tbody>{days.map(day => day.items.length ? day.items.map((item, index) => <tr key={day.day + item.key}>
          {index === 0 && <th scope="rowgroup" rowSpan={day.items.length} title={day.day}>{dayStart(day.day).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit',timeZone:'Asia/Bangkok'})}</th>}
          <td className="expense-description">{item.details.length ? <ExpenseDetailsButton
            title={item.description + ' · ' + day.day}
            label={item.description + ' (' + item.count + ' รายการ)'}
            entries={item.details}
          /> : item.description}</td>
          <td className="numeric expense-count">{item.count}</td>
          <td className="numeric tone-expense">{amount(item.amountSatang)}</td>
        </tr>) : <tr key={day.day}>
          <th scope="row">{day.day}</th><td className="muted">ไม่มีรายการ</td>
          <td className="numeric expense-count">0</td><td className="numeric">0.00</td>
        </tr>)}</tbody>
        <tfoot><tr>
          <th scope="row" colSpan={2}>รวมค่าใช้จ่าย</th>
          <td className="numeric expense-count">{days.reduce((sum, day) => sum + day.count, 0)}</td>
          <td className="numeric tone-expense">{amount(days.reduce((sum, day) => sum + day.totalSatang, 0))}</td>
        </tr></tfoot>
      </table>
    </div>
  </section>;
}
