'use client';

import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {websitePaymentReady, type WebsitePaymentDetails} from '@/lib/website-payment';

export function WebsitePaymentForm({initial}: {initial: WebsitePaymentDetails}) {
  const router = useRouter();
  const [details, setDetails] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { setDetails(initial); }, [initial]);
  return <form className="form-grid" method="post" action="/api/admin/website-payment-settings" onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      const response = await fetch('/api/admin/website-payment-settings', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...details, expectedVersion: details.version}),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'บันทึกข้อมูลไม่สำเร็จ');
      setDetails(result.details); setSaved(true); router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่');
    } finally { setBusy(false); }
  }}>
    <label>ธนาคาร<input name="bankName" value={details.bankName} maxLength={100} disabled={busy} onChange={event => {setDetails({...details, bankName: event.target.value}); setSaved(false);}}/></label>
    <label>ชื่อบัญชี<input name="accountName" value={details.accountName} maxLength={200} disabled={busy} onChange={event => {setDetails({...details, accountName: event.target.value}); setSaved(false);}}/></label>
    <label>เลขบัญชี<input name="accountNumber" value={details.accountNumber} inputMode="numeric" autoComplete="off" maxLength={100} disabled={busy} onChange={event => {setDetails({...details, accountNumber: event.target.value}); setSaved(false);}}/><small>6–30 หลัก ใส่ขีดหรือเว้นวรรคได้</small></label>
    <div><p className="muted">กรอกทั้งสามช่องเพื่อเปิดการโอนเงิน หรือเว้นว่างทั้งหมดเพื่อปิดบัญชีรับโอน</p><p className="muted">{websitePaymentReady(details) ? 'ตั้งค่าบัญชีรับโอนแล้ว' : 'ยังไม่ได้ตั้งค่าบัญชีรับโอน'}</p></div>
    {error && <p className="notice" role="alert">{error}</p>}
    {saved && <p className="notice live" role="status">บันทึกข้อมูลการชำระเงินแล้ว</p>}
    <div className="actions"><button disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}</button><button type="button" className="secondary" disabled={busy} onClick={() => {setError(''); setSaved(false); router.refresh();}}>โหลดข้อมูลล่าสุด</button></div>
  </form>;
}
