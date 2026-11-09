'use client';

import {useId, useRef} from 'react';

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

export function ExpenseDetailsButton({title, label, entries}: {
  title: string;
  label: string;
  entries: Entry[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return <>
    <button type="button" className="expense-summary-button" aria-haspopup="dialog"
      onClick={() => dialog.current?.showModal()}>{label}</button>
    <dialog ref={dialog} className="stock-modal expense-detail-modal" aria-labelledby={titleId}>
      <div className="intro">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="secondary" onClick={() => dialog.current?.close()}>ปิด</button>
      </div>
      <p>{entries.length} รายการ · รวม {money(entries.reduce((sum, entry) => sum + entry.amountSatang, 0))}</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>รายละเอียด</th><th>จำนวนเงิน</th></tr></thead>
          <tbody>{entries.map(entry => <tr key={entry.id}>
            <td style={{whiteSpace: 'normal'}}>
              {entry.description}
              {entry.tracking && <small className="order-meta">{entry.tracking}</small>}
              {entry.estimated && <small className="order-meta">ต้นทุนประมาณการ</small>}
            </td>
            <td>{money(entry.amountSatang)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </dialog>
  </>;
}
