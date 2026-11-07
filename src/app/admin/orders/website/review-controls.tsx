'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';

export function WebsiteOrderReviewControls({id, status}: {id: string; status: string}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  if (status !== 'PENDING_REVIEW') return null;

  async function review(decision: 'APPROVED' | 'REJECTED') {
    if (busy || saved) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/website-orders', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id, status: decision, expectedStatus: 'PENDING_REVIEW', note}),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'บันทึกผลตรวจสอบไม่สำเร็จ');
      setSaved(true);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'บันทึกผลตรวจสอบไม่สำเร็จ');
    } finally { setBusy(false); }
  }

  return <div className="website-order-review">
    <label>หมายเหตุการตรวจสอบ<textarea value={note} maxLength={1000} rows={2} disabled={busy || saved} onChange={event => setNote(event.target.value)}/></label>
    {error && <p className="notice" role="alert">{error}</p>}
    {saved && <p className="notice live" role="status">บันทึกผลตรวจสอบแล้ว</p>}
    <div className="actions">
      <button type="button" disabled={busy || saved} onClick={() => review('APPROVED')}>ตรวจสอบผ่าน</button>
      <button type="button" className="secondary" disabled={busy || saved} onClick={() => review('REJECTED')}>ปฏิเสธ</button>
    </div>
  </div>;
}
