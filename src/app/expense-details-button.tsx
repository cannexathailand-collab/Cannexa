'use client';

import {PopupDetails} from './popup-details';

type Entry = {
  id: string;
  description: string;
  amountSatang: number;
  tracking?: string;
  estimated?: boolean;
  recipient?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  rawText?: string | null;
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

  return <PopupDetails className="expense-cost-details expense-group" summary={label} title={title}>
      <p className="financial-total tone-expense">{entries.length} รายการ · รวม {money(total)}</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ลำดับ</th><th>รายการ</th><th className="numeric">จำนวนเงิน (บาท)</th></tr></thead>
          <tbody>{entries.map((entry, index) => <tr key={entry.id}>
            <td>{index + 1}</td>
            <td style={{whiteSpace: 'normal'}}>
              {entry.description}
              {entry.tracking && <small className="order-meta">{entry.tracking}</small>}
              {entry.estimated && <small className="order-meta">ต้นทุนประมาณการ</small>}
              {entry.recipient && <small className="order-meta">ผู้รับ {entry.recipient}</small>}
              {entry.bankAccount && <small className="order-meta">{entry.bankName} ••••{entry.bankAccount.slice(-4)}</small>}
              {entry.rawText && <PopupDetails summary="ดูข้อความต้นฉบับ"><pre>{entry.rawText}</pre></PopupDetails>}
            </td>
            <td className="numeric tone-expense">{amount(entry.amountSatang)}</td>
          </tr>)}</tbody>
          <tfoot><tr><th colSpan={2}>รวม</th><td className="numeric tone-expense">{amount(total)}</td></tr></tfoot>
        </table>
      </div>
  </PopupDetails>;
}
