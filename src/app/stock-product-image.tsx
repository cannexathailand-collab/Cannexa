'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';

type Props = {
  code: string;
  name: string | null;
  imageVersion: string | null;
  extraVersions?: Partial<Record<2 | 3, string>>;
  editable: boolean;
};

const maxImageBytes = 2 * 1024 * 1024;
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];

export function StockProductImage({code, name, imageVersion, extraVersions = {}, editable}: Props) {
  const router = useRouter();
  const headingId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const reader = useRef<FileReader | null>(null);
  const [version, setVersion] = useState(imageVersion);
  const [extras, setExtras] = useState(extraVersions);
  const [slot, setSlot] = useState<1 | 2 | 3>(1);
  const [expectedVersion, setExpectedVersion] = useState(imageVersion);
  const [draft, setDraft] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const imageUrl = version ? '/api/stock/' + encodeURIComponent(code) + '/image?v=' + version : null;
  const selectedVersion = slot === 1 ? version : extras[slot] ?? null;
  const selectedUrl = selectedVersion ? '/api/stock/' + encodeURIComponent(code) + '/image?slot=' + slot + '&v=' + selectedVersion : null;

  useEffect(() => setVersion(imageVersion), [imageVersion]);
  useEffect(() => setExtras(extraVersions), [extraVersions[2], extraVersions[3]]);
  useEffect(() => () => reader.current?.abort(), []);

  function close() {
    reader.current?.abort();
    reader.current = null;
    setReading(false);
    dialog.current?.close();
  }

  function open() {
    reader.current?.abort();
    reader.current = null;
    setExpectedVersion(version);
    setSlot(1);
    setDraft(null);
    setReading(false);
    setError('');
    setEditorKey(value => value + 1);
    dialog.current?.showModal();
  }

  function selectImage(file?: File) {
    reader.current?.abort();
    reader.current = null;
    setDraft(null);
    setError('');
    setReading(false);
    if (!file) return;
    if (!imageTypes.includes(file.type)) {
      setError('เลือกรูป JPG, PNG หรือ WebP');
      return;
    }
    if (!file.size || file.size > maxImageBytes) {
      setError('รูปภาพต้องมีขนาดไม่เกิน 2 MB');
      return;
    }
    const nextReader = new FileReader();
    reader.current = nextReader;
    setReading(true);
    nextReader.onload = async () => {
      if (reader.current !== nextReader) return;
      try {
        if (typeof nextReader.result !== 'string') throw Error();
        const preview = new Image();
        preview.src = nextReader.result;
        await preview.decode();
        if (reader.current !== nextReader) return;
        setDraft(nextReader.result);
        setReading(false);
      } catch {
        if (reader.current !== nextReader) return;
        setError('รูปภาพไม่สมบูรณ์หรือเปิดอ่านไม่ได้ กรุณาเลือกไฟล์ใหม่');
        setReading(false);
      }
    };
    nextReader.onerror = () => {
      if (reader.current !== nextReader) return;
      setError('อ่านรูปภาพไม่ได้ กรุณาเลือกไฟล์อีกครั้ง');
      setReading(false);
    };
    nextReader.readAsDataURL(file);
  }

  return <div className="stock-product-image">
    {imageUrl
      ? <img className="stock-product-thumbnail" src={imageUrl} alt={'รูปสินค้า ' + code} width={64} height={64} loading="lazy"/>
      : <span className="stock-product-image-empty">ไม่มีรูป</span>}
    {editable && <>
      <button type="button" className="secondary stock-product-image-button" onClick={open} aria-label={(version ? 'เปลี่ยนรูป ' : 'เพิ่มรูป ') + code}>
        {version ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}
      </button>
      <dialog className="stock-modal" ref={dialog} aria-labelledby={headingId} onCancel={event => {
        if (busy) event.preventDefault();
        else close();
      }}>
        <h2 id={headingId}>รูปสินค้า {code}</h2>
        {name && <p className="muted">{name}</p>}
        <p className="small muted">รูปหลักใช้ในหน้า Shop ส่วนรูปเสริมสองรูปเก็บไว้ใช้ประกอบการ์ด LINE OA</p>
        <div className="actions" aria-label="เลือกรูปสินค้า">
          {([1, 2, 3] as const).map(nextSlot => <button key={nextSlot} type="button" className={slot === nextSlot ? undefined : 'secondary'} aria-pressed={slot === nextSlot} disabled={busy || reading} onClick={() => {
            setSlot(nextSlot);
            setExpectedVersion(nextSlot === 1 ? version : extras[nextSlot] ?? null);
            setDraft(null);
            setError('');
            setEditorKey(value => value + 1);
          }}>{nextSlot === 1 ? 'รูปหลัก' : 'รูปเสริม ' + (nextSlot - 1)}</button>)}
        </div>
        <form key={editorKey} onSubmit={async event => {
          event.preventDefault();
          if (!draft || busy || reading) return;
          setBusy(true);
          setError('');
          try {
            const response = await fetch('/api/admin/stock/image', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({code, slot, expectedVersion, image: draft}),
              signal: AbortSignal.timeout(30000),
            });
            const result = await response.json();
            if (!response.ok) throw Error(result.error || 'บันทึกรูปภาพไม่สำเร็จ');
            if (slot === 1) setVersion(result.imageVersion);
            else setExtras(previous => ({...previous, [slot]: result.imageVersion}));
            close();
            router.refresh();
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'บันทึกรูปภาพไม่สำเร็จ กรุณาลองใหม่');
          } finally {
            setBusy(false);
          }
        }}>
          {(draft || selectedUrl) && <img className="stock-product-image-preview" src={draft || selectedUrl!} alt={'ตัวอย่าง' + (slot === 1 ? 'รูปหลัก ' : 'รูปเสริม ' + (slot - 1) + ' ') + code}/>}
          <label>{slot === 1 ? 'รูปหลักสินค้า' : 'รูปเสริม ' + (slot - 1)}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || reading} onChange={event => selectImage(event.target.files?.[0])}/>
          </label>
          <p className="small muted">JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB</p>
          {error && <p className="notice" role="alert">{error}</p>}
          <div className="actions">
            <button type="submit" disabled={!draft || busy || reading}>{busy ? 'กำลังบันทึก…' : reading ? 'กำลังอ่านรูป…' : 'บันทึกรูป'}</button>
            <button type="button" className="secondary" disabled={busy} onClick={close}>ยกเลิก</button>
          </div>
        </form>
      </dialog>
    </>}
  </div>;
}
