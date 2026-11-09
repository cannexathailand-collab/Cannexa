'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';

const satang = (value: string) => {
  const text = value.replace(/[,\s]/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 2147483647 ? amount : null;
};

export function WebsiteOrderReviewControls({id, status, totalSatang, sellerCode}: {id: string; status: string; totalSatang: number; sellerCode: string}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState('');
  const [amount, setAmount] = useState((totalSatang / 100).toFixed(2));
  const [seller, setSeller] = useState(sellerCode);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  if (status !== 'PENDING_REVIEW') return null;

  async function review(decision: 'APPROVED' | 'REJECTED') {
    if (busy || saved) return;
    const amountSatang = satang(amount);
    if (decision === 'APPROVED') {
      if (!payment) { setError('กรุณาเลือกวิธีชำระเงินก่อนอนุมัติ'); return; }
      if (!amountSatang) { setError('กรุณาระบุยอดเก็บเงินเป็นตัวเลขที่มากกว่าศูนย์'); return; }
      if (!/^[A-Za-z0-9._-]{3,64}$/.test(seller.trim())) { setError('กรุณาระบุรหัสผู้ขาย 3–64 ตัวอักษร'); return; }
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/website-orders', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(decision === 'APPROVED'
          ? {id, status: decision, expectedStatus: 'PENDING_REVIEW', note, payment, amountSatang, sellerCode: seller.trim()}
          : {id, status: decision, expectedStatus: 'PENDING_REVIEW', note}),
        signal: AbortSignal.timeout(60000),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'บันทึกผลตรวจสอบไม่สำเร็จ');
      setSaved(true);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'บันทึกผลตรวจสอบไม่สำเร็จ');
    } finally { setBusy(false); }
  }

  const disabled = busy || saved;
  return <div className="website-order-review">
    <div className="website-order-approval">
      <label>วิธีชำระเงิน<select value={payment} disabled={disabled} onChange={event => setPayment(event.target.value)}>
        <option value="">เลือกวิธีชำระเงิน</option><option value="COD">COD</option><option value="โอน">โอน</option>
      </select></label>
      <label>ยอดเก็บเงิน (บาท)<input inputMode="decimal" value={amount} disabled={disabled} onChange={event => setAmount(event.target.value)}/></label>
      <label>รหัสผู้ขาย<input value={seller} maxLength={64} disabled={disabled} onChange={event => setSeller(event.target.value)}/></label>
    </div>
    <p className="muted small">ยอดเก็บเงินรวมค่าส่งได้ ระบบใช้ยอดนี้จับคู่ COD และคิดยอดโอน</p>
    <label>หมายเหตุการตรวจสอบ<textarea value={note} maxLength={1000} rows={2} disabled={disabled} onChange={event => setNote(event.target.value)}/></label>
    {error && <p className="notice" role="alert">{error}</p>}
    {saved && <p className="notice live" role="status">บันทึกผลตรวจสอบแล้ว</p>}
    <div className="actions">
      <button type="button" disabled={disabled} onClick={() => review('APPROVED')}>{busy ? 'กำลังบันทึก…' : 'อนุมัติและส่งเข้าระบบจัดส่ง'}</button>
      <button type="button" className="secondary" disabled={disabled} onClick={() => review('REJECTED')}>ปฏิเสธ</button>
    </div>
  </div>;
}
