'use client';

import {PopupDetails} from './popup-details';

type Entry = {
  id: string;
  description: string;
  amountSatang: number;
  tracking?: string;
  estimated?: boolean;
};

const money = (amount: number) => (amount / 100).toLocaleString('th-TH', {
  style: 'currency', currency: 'THB',
});
const amount = (value: number) => (value / 100).toLocaleString('th-TH', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export function ExpenseDetailsButton({title, label, entries}: {
  title: string;
  label: string;
  entries: Entry[];
}) {
  const total = entries.reduce((sum, entry) => sum + entry.amountSatang, 0);

  return <PopupDetails className="expense-cost-details" summary={label} title={title}>
      <p>{entries.length} รายการ · รวม {money(total)}</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ลำดับ</th><th>รายการ</th><th className="numeric">จำนวนเงิน (บาท)</th></tr></thead>
          <tbody>{entries.map((entry, index) => <tr key={entry.id}>
            <td>{index + 1}</td>
            <td style={{whiteSpace: 'normal'}}>
              {entry.description}
              {entry.tracking && <small className="order-meta">{entry.tracking}</small>}
              {entry.estimated && <small className="order-meta">ต้นทุนประมาณการ</small>}
            </td>
            <td className="numeric">{amount(entry.amountSatang)}</td>
          </tr>)}</tbody>
          <tfoot><tr><th colSpan={2}>รวม</th><td className="numeric">{amount(total)}</td></tr></tfoot>
        </table>
      </div>
  </PopupDetails>;
}
