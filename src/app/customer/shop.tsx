'use client';

import {useEffect, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import type {CustomerCatalog, CustomerCatalogProduct} from '@/lib/customer-catalog';
import {cartItemKey, cartQuantityError, readCustomerCart, type CustomerCartItem} from '@/lib/customer-cart';
import {checkoutCartItems, createCustomerCheckout, isDefiniteCheckoutFailure, readCheckoutOrder, readCustomerCheckout, type CustomerCheckoutOrder, type CustomerCheckoutPayload} from '@/lib/customer-checkout';
import {websitePaymentReady, websiteShippingFees, type WebsitePaymentDetails, type WebsitePaymentMethod} from '@/lib/website-payment';

const money = (satang: number) => (satang / 100).toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const imageUrl = (product: CustomerCatalogProduct) => '/api/stock/' + encodeURIComponent(product.code) + '/image?v=' + product.imageVersion;
const orderStatus: Record<string, string> = {PENDING_REVIEW: 'รอเจ้าหน้าที่ตรวจสอบ', APPROVED: 'เจ้าหน้าที่อนุมัติแล้ว', REJECTED: 'เจ้าหน้าที่ไม่อนุมัติ'};

function ShopProduct({product, disabled, onAdd}: {
  product: CustomerCatalogProduct;
  disabled: boolean;
  onAdd: (product: CustomerCatalogProduct, pack: string) => boolean;
}) {
  const [pack, setPack] = useState(product.prices.find(price => price.priceSatang > 0)?.pack ?? '');
  const [added, setAdded] = useState<{
    sequence: number;
    name: string;
    pack: string;
    priceSatang: number;
  } | null>(null);
  const selected = product.prices.find(price => price.pack === pack) ?? product.prices.find(price => price.priceSatang > 0);
  const available = selected && selected.priceSatang > 0 && product.available !== null && product.available >= selected.grams;

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(null), 2000);
    return () => window.clearTimeout(timer);
  }, [added]);

  return <article className="shop-product">
    <div className="shop-product-picture">
      {product.imageVersion
        ? <img src={imageUrl(product)} alt={'รูปสินค้า ' + product.code} loading="lazy" width={240} height={240}/>
        : <span>ไม่มีรูปสินค้า</span>}
    </div>
    <div className="shop-product-details">
      <span className="shop-product-code">{product.code}</span>
      <h3>{product.name || 'ยังไม่ระบุชื่อสินค้า'}</h3>
      {product.prices.length > 0 ? <label className="shop-package-label">ขนาดสินค้า
        <select aria-label={'ขนาด ' + product.code} value={selected?.pack ?? ''} onChange={event => setPack(event.target.value)}>
          {product.prices.map(price => <option key={price.pack} value={price.pack} disabled={price.priceSatang <= 0}>
            {price.pack} · {money(price.priceSatang)} บาท
          </option>)}
        </select>
      </label> : <p className="shop-unavailable">ยังไม่มีราคาขาย</p>}
      <p className="shop-product-price">{selected ? money(selected.priceSatang) + ' บาท' : 'รอระบุราคา'}</p>
      <span className={'shop-availability' + (available ? ' available' : '')}>
        {available ? 'พร้อมขาย' : product.available === null ? 'รอข้อมูลสต๊อก' : 'ขนาดนี้ยังไม่พร้อมขาย'}
      </span>
      <div className="shop-add-action">
        {added && <div key={added.sequence} className="shop-add-feedback" role="status">
          <strong><span aria-hidden="true">✓</span> เพิ่มลงตะกร้าแล้ว</strong>
          <span>{added.name}</span>
          <span>จำนวน 1 · {added.pack} · {money(added.priceSatang)} บาท</span>
        </div>}
        <button type="button" aria-label={'เพิ่มลงตะกร้า ' + product.code} disabled={disabled || !available} onClick={() => {
          if (selected && onAdd(product, selected.pack)) {
            setAdded(previous => ({
              sequence: (previous?.sequence ?? 0) + 1,
              name: product.name || product.code,
              pack: selected.pack,
              priceSatang: selected.priceSatang,
            }));
          } else setAdded(null);
        }}>
          เพิ่มลงตะกร้า
        </button>
      </div>
    </div>
  </article>;
}

export function CustomerShop({customerCode, initialCatalog, readOnly = false}: {
  customerCode: string;
  initialCatalog: CustomerCatalog;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [catalog, setCatalog] = useState(initialCatalog);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [cart, setCart] = useState<{key: string | null; items: CustomerCartItem[]}>({key: null, items: []});
  const [checkout, setCheckout] = useState<{key: string | null; payload: CustomerCheckoutPayload | null}>({key: null, payload: null});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{key: string; order: CustomerCheckoutOrder} | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<WebsitePaymentMethod | ''>('');
  const [paymentDetails, setPaymentDetails] = useState<WebsitePaymentDetails | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [paymentError, setPaymentError] = useState('');
  const [paymentRefresh, setPaymentRefresh] = useState(0);
  const [slip, setSlip] = useState<string | null>(null);
  const [slipName, setSlipName] = useState('');
  const [readingSlip, setReadingSlip] = useState(false);
  const slipReader = useRef<FileReader | null>(null);
  const bankVersion = useRef<string | null>(null);
  const sending = useRef(false);
  const cartDialog = useRef<HTMLDialogElement>(null);
  const storageKey = readOnly ? null : 'cannexa:shop-cart:v1:' + customerCode;
  const checkoutKey = readOnly ? null : 'cannexa:shop-checkout:v1:' + customerCode;
  const activeKey = useRef(checkoutKey);
  activeKey.current = checkoutKey;
  const ready = cart.key === storageKey && checkout.key === checkoutKey;
  const pending = ready ? checkout.payload : null;
  const locked = !ready || submitting || !!pending;
  const confirmation = submitted?.key === checkoutKey ? submitted.order : null;
  const items = ready ? cart.items : [];
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const products = new Map(catalog.products.map(product => [product.code, product]));

  useEffect(() => setCatalog(initialCatalog), [initialCatalog]);
  useEffect(() => {
    slipReader.current?.abort();
    slipReader.current = null;
    setReadingSlip(false);
    bankVersion.current = null;
    let saved: CustomerCartItem[] = [];
    let payload: CustomerCheckoutPayload | null = null;
    if (storageKey) {
      try {
        saved = readCustomerCart(localStorage.getItem(storageKey));
        payload = readCustomerCheckout(localStorage.getItem(checkoutKey!));
        if (payload) saved = checkoutCartItems(payload);
      } catch {}
    }
    setCart({key: storageKey, items: saved});
    setCheckout({key: checkoutKey, payload});
    setSubmitted(null);
    setError('');
    setPaymentMethod(payload?.paymentMethod ?? '');
    setSlip(payload?.slip ?? null);
    setSlipName(payload?.slip ? 'สลิปจากคำขอเดิม' : '');
  }, [storageKey, checkoutKey]);
  useEffect(() => {
    if (!storageKey || cart.key !== storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(cart.items)); } catch {}
  }, [cart, storageKey]);

  useEffect(() => {
    const controller = new AbortController();
    setPaymentLoading(true);
    setPaymentDetails(null);
    setPaymentError('');
    fetch('/api/customer/payment-settings', {cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])})
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw Error(result.error || 'โหลดข้อมูลบัญชีรับโอนไม่สำเร็จ');
        if (!result.details || ['bankName', 'accountName', 'accountNumber'].some(field => typeof result.details[field] !== 'string')) {
          throw Error('ข้อมูลบัญชีรับโอนไม่สมบูรณ์');
        }
        if (!controller.signal.aborted) {
          if (bankVersion.current && bankVersion.current !== result.details.version) {
            slipReader.current?.abort();
            slipReader.current = null;
            setReadingSlip(false);
            setSlip(null);
            setSlipName('');
          }
          bankVersion.current = result.details.version;
          setPaymentDetails(result.details);
        }
      })
      .catch(failure => {
        if (!controller.signal.aborted) setPaymentError(failure instanceof Error ? failure.message : 'โหลดข้อมูลบัญชีรับโอนไม่สำเร็จ');
      })
      .finally(() => { if (!controller.signal.aborted) setPaymentLoading(false); });
    return () => controller.abort();
  }, [customerCode, paymentRefresh]);
  useEffect(() => () => slipReader.current?.abort(), []);

  function selectSlip(file?: File) {
    slipReader.current?.abort();
    slipReader.current = null;
    setSlip(null);
    setSlipName('');
    setReadingSlip(false);
    setPaymentError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > 2 * 1024 * 1024) {
      setPaymentError('เลือกสลิป JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB');
      return;
    }
    const reader = new FileReader();
    slipReader.current = reader;
    setReadingSlip(true);
    reader.onload = async () => {
      try {
        if (typeof reader.result !== 'string') throw Error();
        const image = new Image();
        image.src = reader.result;
        await image.decode();
        if (slipReader.current !== reader) return;
        setSlip(reader.result);
        setSlipName(file.name);
      } catch {
        if (slipReader.current === reader) setPaymentError('เปิดรูปสลิปไม่ได้ กรุณาเลือกไฟล์ใหม่');
      } finally {
        if (slipReader.current === reader) setReadingSlip(false);
      }
    };
    reader.onerror = () => {
      if (slipReader.current !== reader) return;
      setPaymentError('อ่านสลิปไม่ได้ กรุณาเลือกไฟล์ใหม่');
      setReadingSlip(false);
    };
    reader.readAsDataURL(file);
  }

  function add(product: CustomerCatalogProduct, pack: string) {
    const price = product.prices.find(candidate => candidate.pack === pack);
    if (!price || locked || sending.current) return false;
    const key = cartItemKey({code: product.code, pack});
    const existing = items.find(item => cartItemKey(item) === key);
    const quantity = (existing?.quantity ?? 0) + 1;
    const problem = cartQuantityError(items, product, price, quantity);
    if (problem) { setError(problem); return false; }
    if (!existing && items.length >= 100) { setError('ตะกร้ารองรับได้ไม่เกิน 100 รายการ'); return false; }
    setCart({key: storageKey, items: existing
      ? items.map(item => cartItemKey(item) === key ? {...item, quantity} : item)
      : [...items, {code: product.code, pack, quantity}]});
    setError('');
    setSubmitted(null);
    return true;
  }

  function setQuantity(item: CustomerCartItem, quantity: number) {
    const product = products.get(item.code);
    const price = product?.prices.find(candidate => candidate.pack === item.pack);
    if (!product || !price || locked || sending.current) return;
    const problem = cartQuantityError(items, product, price, quantity);
    if (problem) { setError(problem); return; }
    setCart({key: storageKey, items: items.map(candidate => cartItemKey(candidate) === cartItemKey(item) ? {...candidate, quantity} : candidate)});
    setError('');
    setSubmitted(null);
  }

  async function sendOrder() {
    if (readOnly || !ready || !storageKey || !checkoutKey || sending.current) return;
    sending.current = true;
    setSubmitting(true);
    setError('');
    let payload: CustomerCheckoutPayload;
    try {
      // Reuse the stored request even if another tab prepared it or catalog prices changed.
      const previous = pending ?? readCustomerCheckout(localStorage.getItem(checkoutKey));
      if (previous) payload = previous;
      else {
        if (!paymentMethod) throw Error('กรุณาเลือกวิธีชำระเงิน');
        payload = createCustomerCheckout(items, catalog.products, crypto.randomUUID(), {
          paymentMethod,
          bankVersion: paymentMethod === 'TRANSFER' ? paymentDetails?.version ?? null : null,
          ...(paymentMethod === 'TRANSFER' && slip ? {slip} : {}),
        });
      }
      localStorage.setItem(checkoutKey, JSON.stringify(payload));
      setCheckout({key: checkoutKey, payload});
      setCart({key: storageKey, items: checkoutCartItems(payload)});
      setSubmitted(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'เก็บคำขอไว้ในเครื่องไม่ได้ กรุณาลองใหม่');
      sending.current = false;
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/customer/website-orders', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload), signal: AbortSignal.timeout(30000),
      });
      const result = await response.json().catch(() => null);
      const order = result?.ok === true ? readCheckoutOrder(result.order) : null;
      if (response.ok && order && order.totalSatang === payload.expectedTotalSatang) {
        if (activeKey.current === checkoutKey) setSubmitted({key: checkoutKey, order});
        // Emptying the cart first preserves the retry payload if storage cleanup is interrupted.
        try {
          localStorage.setItem(storageKey, '[]');
          localStorage.removeItem(checkoutKey);
        } catch {
          if (activeKey.current === checkoutKey) {
            setError('ส่งออเดอร์สำเร็จแล้ว แต่ยังล้างคำขอในเครื่องไม่ได้ กด “ลองส่งอีกครั้ง” เพื่อยืนยันคำขอเดิม');
            router.refresh();
          }
          return;
        }
        if (activeKey.current === checkoutKey) {
          setCart({key: storageKey, items: []});
          setCheckout({key: checkoutKey, payload: null});
          setPaymentMethod('');
          setSlip(null);
          setSlipName('');
          router.refresh();
        }
        return;
      }
      if (isDefiniteCheckoutFailure(response.status, result?.code)) {
        localStorage.removeItem(checkoutKey);
        if (activeKey.current === checkoutKey) {
          setCheckout({key: checkoutKey, payload: null});
          const help = result?.code === 'INVALID_DELIVERY'
            ? 'กรุณาแก้ไขข้อมูลจัดส่งในแท็บข้อมูลส่วนตัวก่อนส่งอีกครั้ง'
            : 'กรุณาอัปเดตรายการสินค้าและตรวจข้อมูลก่อนส่งอีกครั้ง';
          setError((typeof result?.error === 'string' ? result.error + ' · ' : '') + help);
        }
        return;
      }
      if (response.status >= 400 && response.status < 500) {
        if (activeKey.current === checkoutKey) {
          const help = result?.code === 'REQUEST_CONFLICT'
            ? 'คำขอนี้อาจมีออเดอร์อยู่แล้ว กรุณาตรวจประวัติออเดอร์หรือติดต่อร้าน โดยเก็บคำขอเดิมไว้ก่อน'
            : response.status === 401 || response.status === 403
              ? 'กรุณาเข้าสู่ระบบด้วยบัญชีลูกค้าเดิม แล้วกด “ลองส่งอีกครั้ง” เพื่อยืนยันคำขอเดิม'
              : 'ยังยืนยันผลไม่ได้ กรุณารอสักครู่แล้วกด “ลองส่งอีกครั้ง” โดยใช้คำขอเดิม';
          setError((typeof result?.error === 'string' ? result.error + ' · ' : '') + help);
        }
        return;
      }
      throw Error('ยังยืนยันผลการส่งออเดอร์ไม่ได้ กด “ลองส่งอีกครั้ง” เพื่อใช้คำขอเดิม');
    } catch (failure) {
      if (activeKey.current === checkoutKey) setError(failure instanceof Error && failure.message.startsWith('ยังยืนยัน')
        ? failure.message : 'ยังยืนยันผลการส่งออเดอร์ไม่ได้ กด “ลองส่งอีกครั้ง” เพื่อใช้คำขอเดิม');
    } finally {
      sending.current = false;
      setSubmitting(false);
    }
  }

  const search = query.trim().normalize('NFKC').toLocaleLowerCase();
  const visibleProducts = catalog.products.filter(product => (product.code + ' ' + (product.name ?? '')).normalize('NFKC').toLocaleLowerCase().includes(search));
  const subtotal = items.reduce((sum, item) => {
    const original = pending?.items.find(candidate => cartItemKey(candidate) === cartItemKey(item));
    const price = products.get(item.code)?.prices.find(candidate => candidate.pack === item.pack);
    return sum + (original?.expectedUnitPriceSatang ?? price?.priceSatang ?? 0) * item.quantity;
  }, 0);
  const selectedPayment = pending ? pending.paymentMethod ?? '' : paymentMethod;
  const shipping = pending ? pending.expectedShippingSatang ?? 0 : selectedPayment ? websiteShippingFees[selectedPayment] : 0;
  const total = pending?.expectedTotalSatang ?? subtotal + shipping;
  const bankReady = !!paymentDetails?.version && websitePaymentReady(paymentDetails);
  const paymentReady = selectedPayment === 'COD' || selectedPayment === 'TRANSFER' && bankReady && !paymentLoading && !!slip;
  const shownSlip = pending?.slip ?? slip;

  return <section className="portal-section customer-shop">
    <div className="shop-heading">
      <div><h2>Shop</h2><p className="portal-muted">เลือกสินค้าและจัดรายการในตะกร้า</p></div>
      <button className="shop-cart-button" type="button" aria-label="ตะกร้า" onClick={() => {setError(''); cartDialog.current?.showModal();}}>
        <span aria-hidden="true">🛒</span> ตะกร้า <strong aria-hidden="true">{count}</strong>
      </button>
    </div>
    <div className="shop-toolbar">
      <label>ค้นหาสินค้า<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="รหัสหรือชื่อสินค้า"/></label>
      <button type="button" className="secondary" disabled={refreshing} onClick={async () => {
        setRefreshing(true);
        setError('');
        try {
          const response = await fetch('/api/customer/catalog', {cache: 'no-store', signal: AbortSignal.timeout(15000)});
          const result = await response.json();
          if (!response.ok || !Array.isArray(result.products)) throw Error(result.error || 'โหลดสินค้าไม่สำเร็จ');
          setCatalog(result);
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : 'โหลดสินค้าไม่สำเร็จ');
        } finally { setRefreshing(false); }
      }}>{refreshing ? 'กำลังอัปเดต…' : 'อัปเดตรายการ'}</button>
    </div>
    {catalog.readAt && <p className="shop-updated">ข้อมูลล่าสุด {new Date(catalog.readAt).toLocaleString('th-TH', {timeZone: 'Asia/Bangkok'})}</p>}
    {readOnly && <p className="portal-muted">โหมดเจ้าของระบบ · ทดลองตะกร้า</p>}
    {pending && <p className="portal-alert" role="status">มีคำขอส่งออเดอร์ที่ยังไม่ยืนยันผล เปิดตะกร้าแล้วกด “ลองส่งอีกครั้ง”</p>}
    {error && <p className="portal-alert" role="alert">{error}</p>}
    <div className="shop-product-grid">
      {visibleProducts.map(product => <ShopProduct key={product.code} product={product} disabled={locked} onAdd={add}/>)}
    </div>
    {!visibleProducts.length && <p className="portal-empty">{query ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้าในรายการ'}</p>}
    <dialog className="stock-modal shop-cart-dialog" ref={cartDialog} aria-labelledby="shop-cart-title">
      <div className="shop-heading"><h2 id="shop-cart-title">ตะกร้า</h2><button type="button" className="secondary" onClick={() => cartDialog.current?.close()}>ปิด</button></div>
      {confirmation && <div className="portal-success" role="status"><h3>ส่งออเดอร์แล้ว</h3><p>{confirmation.orderNumber}</p><p>{orderStatus[confirmation.status] ?? confirmation.status}</p></div>}
      {error && <p className="portal-alert" role="alert">{error}</p>}
      {items.length ? <div className="shop-cart-items">{items.map(item => {
        const product = products.get(item.code);
        const price = product?.prices.find(candidate => candidate.pack === item.pack);
        const unitPrice = pending?.items.find(candidate => cartItemKey(candidate) === cartItemKey(item))?.expectedUnitPriceSatang ?? price?.priceSatang;
        const problem = pending ? null : product && price ? cartQuantityError(items, product, price, item.quantity) : 'สินค้าขนาดนี้ไม่อยู่ในรายการล่าสุด';
        return <article key={cartItemKey(item)} className="shop-cart-item">
          <div><strong>{product?.name || 'ยังไม่ระบุชื่อสินค้า'}</strong><p>{item.code} · {item.pack}</p>{unitPrice !== undefined && <span>{money(unitPrice)} บาท / ชิ้น</span>}</div>
          <label>จำนวน<input type="number" min={1} max={999} step={1} aria-label={'จำนวน ' + item.code + ' ' + item.pack} value={item.quantity} disabled={locked || !price} onChange={event => setQuantity(item, Number(event.target.value))}/></label>
          <strong>{unitPrice !== undefined ? money(unitPrice * item.quantity) + ' บาท' : 'รอราคา'}</strong>
          <button type="button" className="secondary" aria-label={'ลบ ' + item.code + ' ' + item.pack} disabled={locked} onClick={() => {
            if (locked || sending.current) return;
            setCart({key: storageKey, items: items.filter(candidate => cartItemKey(candidate) !== cartItemKey(item))});
            setError('');
          }}>นำออก</button>
          {problem && <p className="shop-cart-warning">{problem}</p>}
        </article>;
      })}</div> : <p className="portal-empty">ยังไม่มีสินค้าในตะกร้า</p>}
      {items.length > 0 && <section className="shop-payment" aria-label="การชำระเงิน">
        <h3>การชำระเงิน</h3>
        <label>วิธีชำระเงิน<select aria-label="วิธีชำระเงิน" value={selectedPayment} disabled={locked} onChange={event => {
          setPaymentMethod(event.target.value as WebsitePaymentMethod | '');
          setPaymentError('');
        }}>
          <option value="">เลือกวิธีชำระเงิน</option>
          <option value="TRANSFER">โอนเงิน · ค่าส่ง {money(websiteShippingFees.TRANSFER)} บาท</option>
          <option value="COD">เก็บเงินปลายทาง (COD) · ค่าส่ง {money(websiteShippingFees.COD)} บาท</option>
        </select></label>
        {selectedPayment === 'TRANSFER' && <>
          {pending && pending.bankVersion !== paymentDetails?.version
            ? <p className="portal-muted">คำขอนี้ใช้บัญชีรับโอนที่ยืนยันไว้ตอนส่งครั้งแรก</p>
            : paymentLoading ? <p className="portal-muted">กำลังโหลดข้อมูลบัญชีรับโอน…</p>
            : bankReady ? <dl className="shop-bank-details">
              <div><dt>ธนาคาร</dt><dd>{paymentDetails!.bankName}</dd></div>
              <div><dt>ชื่อบัญชี</dt><dd>{paymentDetails!.accountName}</dd></div>
              <div><dt>เลขบัญชี</dt><dd>{paymentDetails!.accountNumber}</dd></div>
            </dl> : <p className="portal-alert">รอร้านตั้งค่าบัญชีรับโอน</p>}
          {!pending && <button type="button" className="secondary" disabled={paymentLoading} onClick={() => setPaymentRefresh(value => value + 1)}>อัปเดตข้อมูลบัญชี</button>}
          <p className="portal-muted">ยอดโอนรวมค่าส่ง {money(total)} บาท</p>
          {!pending && <label>แนบสลิปการโอนเงิน<input type="file" accept="image/jpeg,image/png,image/webp" disabled={locked || readingSlip || paymentLoading || !bankReady} onChange={event => {
            selectSlip(event.target.files?.[0]);
            event.target.value = '';
          }}/><span className="portal-muted">JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB</span></label>}
          {readingSlip && <p role="status">กำลังอ่านสลิป…</p>}
          {shownSlip && <div className="shop-slip-preview"><img src={shownSlip} alt="สลิปการโอนเงิน"/><span>{slipName || 'สลิปการโอนเงิน'}</span></div>}
        </>}
        {selectedPayment === 'COD' && <p className="portal-muted">ชำระเงินปลายทางรวมค่าส่ง {money(total)} บาท</p>}
        {paymentError && <p role="alert" className="portal-alert">{paymentError}</p>}
      </section>}
      <div className="shop-price-summary"><span>ยอดสินค้า</span><strong>{money(subtotal)} บาท</strong></div>
      <div className="shop-price-summary"><span>ค่าจัดส่ง</span><strong>{selectedPayment || pending ? money(shipping) + ' บาท' : 'เลือกวิธีชำระเงิน'}</strong></div>
      <div className="shop-cart-total"><span>ยอดรวม</span><strong>{Number.isSafeInteger(total) ? money(total) + ' บาท' : 'กรุณาตรวจสอบยอดรวม'}</strong></div>
      <p className="portal-muted">{readOnly ? 'ตะกร้าทดลองสำหรับเจ้าของระบบ' : 'ออเดอร์ที่ส่งจะรอเจ้าหน้าที่ตรวจสอบ'}</p>
      {pending && <p className="portal-muted">กำลังใช้รายการและราคาของคำขอเดิม กรุณายืนยันผลก่อนแก้ไขตะกร้า</p>}
      {items.length > 0 && <div className="actions">
        {!readOnly && <button type="button" disabled={!ready || submitting || readingSlip || !pending && !paymentReady} onClick={sendOrder}>{submitting ? 'กำลังส่งออเดอร์…' : pending ? 'ลองส่งอีกครั้ง' : 'ส่งออเดอร์ให้ตรวจสอบ'}</button>}
        <button type="button" className="secondary" disabled={locked} onClick={() => {
          if (locked || sending.current) return;
          slipReader.current?.abort();
          slipReader.current = null;
          setReadingSlip(false);
          setCart({key: storageKey, items: []}); setError('');
          setPaymentMethod(''); setSlip(null); setSlipName('');
        }}>ล้างตะกร้า</button>
      </div>}
    </dialog>
  </section>;
}
