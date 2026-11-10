'use client';

import {useEffect, useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import {websitePaymentReady, type WebsitePaymentDetails} from '@/lib/website-payment';

function readQrImage(file:File):Promise<string>{
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result));
    reader.onerror=()=>reject(Error('อ่านรูป QR ไม่สำเร็จ กรุณาเลือกใหม่'));
    reader.readAsDataURL(file);
  });
}

export function WebsitePaymentForm({initial}: {initial: WebsitePaymentDetails}) {
  const router = useRouter();
  const [details, setDetails] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [qrFile,setQrFile]=useState<File|null>(null);
  const [removeQr,setRemoveQr]=useState(false);
  const localPreview=useMemo(()=>qrFile?URL.createObjectURL(qrFile):null,[qrFile]);
  useEffect(()=>()=>{if(localPreview)URL.revokeObjectURL(localPreview);},[localPreview]);
  useEffect(() => { setDetails(initial);setQrFile(null);setRemoveQr(false); }, [initial]);
  const qrPreview=localPreview??(!removeQr&&details.qrImageVersion?'/api/customer/payment-qr?v='+details.qrImageVersion:null);
  return <form className="form-grid" method="post" action="/api/admin/website-payment-settings" onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      const qrImage=qrFile?await readQrImage(qrFile):removeQr?null:undefined;
      const response = await fetch('/api/admin/website-payment-settings', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...details, expectedVersion: details.version,...(qrImage!==undefined?{qrImage}:{})}),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'บันทึกข้อมูลไม่สำเร็จ');
      setDetails(result.details);setQrFile(null);setRemoveQr(false); setSaved(true); router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่');
    } finally { setBusy(false); }
  }}>
    <label>ธนาคาร<input name="bankName" value={details.bankName} maxLength={100} disabled={busy} onChange={event => {setDetails({...details, bankName: event.target.value}); setSaved(false);}}/></label>
    <label>ชื่อบัญชี<input name="accountName" value={details.accountName} maxLength={200} disabled={busy} onChange={event => {setDetails({...details, accountName: event.target.value}); setSaved(false);}}/></label>
    <label>เลขบัญชี<input name="accountNumber" value={details.accountNumber} inputMode="numeric" autoComplete="off" maxLength={100} disabled={busy} onChange={event => {setDetails({...details, accountNumber: event.target.value}); setSaved(false);}}/><small>6–30 หลัก ใส่ขีดหรือเว้นวรรคได้</small></label>
    <div><p className="muted">กรอกทั้งสามช่องเพื่อเปิดการโอนเงิน หรือเว้นว่างทั้งหมดเพื่อปิดบัญชีรับโอน</p><p className="muted">{websitePaymentReady(details) ? 'ตั้งค่าบัญชีรับโอนแล้ว' : 'ยังไม่ได้ตั้งค่าบัญชีรับโอน'}</p></div>
    <section style={{gridColumn:'1 / -1',borderTop:'1px solid #dce7df',paddingTop:16}}>
      <h3>QR code รับโอนเงิน</h3>
      <label>อัปโหลด QR รับเงิน<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event=>{
        const file=event.target.files?.[0];event.target.value='';if(!file)return;
        setSaved(false);setError('');
        if(file.size>2*1024*1024){setError('รูป QR ต้องมีขนาดไม่เกิน 2 MB');return;}
        if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setError('กรุณาเลือกรูป JPG, PNG หรือ WebP');return;}
        setQrFile(file);setRemoveQr(false);
      }}/><small>JPG, PNG หรือ WebP ไม่เกิน 2 MB · ใช้ QR ของบัญชีรับโอนด้านบน</small></label>
      {qrPreview&&<div style={{display:'grid',justifyItems:'start',gap:10,marginTop:12}}>
        <img src={qrPreview} alt="ตัวอย่าง QR รับเงิน" style={{width:260,maxWidth:'100%',height:'auto',maxHeight:340,objectFit:'contain',background:'#fff',border:'1px solid #dce7df',borderRadius:12,padding:12}}/>
        {qrFile&&<small>{qrFile.name}</small>}
        <button type="button" className="secondary" disabled={busy} onClick={()=>{setQrFile(null);setRemoveQr(true);setSaved(false);}}>ลบรูป QR</button>
      </div>}
      {removeQr&&<p className="muted">รูป QR จะถูกลบเมื่อกดบันทึกข้อมูล</p>}
      <p className="muted small">ลูกค้าจะเห็น QR เมื่อเลือกโอนเงิน · หากเปลี่ยนบัญชีรับโอน รูป QR เดิมจะถูกลบเมื่อบันทึก ให้เลือกรูปของบัญชีใหม่พร้อมกัน</p>
    </section>
    {error && <p className="notice" role="alert">{error}</p>}
    {saved && <p className="notice live" role="status">บันทึกข้อมูลการชำระเงินแล้ว</p>}
    <div className="actions"><button disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}</button><button type="button" className="secondary" disabled={busy} onClick={() => {setError(''); setSaved(false); router.refresh();}}>โหลดข้อมูลล่าสุด</button></div>
  </form>;
}
