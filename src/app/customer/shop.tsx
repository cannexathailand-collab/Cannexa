'use client';

import {useEffect, useRef, useState} from 'react';
import type {CustomerCatalog, CustomerCatalogProduct} from '@/lib/customer-catalog';
import {cartItemKey, cartQuantityError, readCustomerCart, type CustomerCartItem} from '@/lib/customer-cart';

const money = (satang: number) => (satang / 100).toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const imageUrl = (product: CustomerCatalogProduct) => '/api/stock/' + encodeURIComponent(product.code) + '/image?v=' + product.imageVersion;

function ShopProduct({product, disabled, onAdd}: {
  product: CustomerCatalogProduct;
  disabled: boolean;
  onAdd: (product: CustomerCatalogProduct, pack: string) => void;
}) {
  const [pack, setPack] = useState(product.prices.find(price => price.priceSatang > 0)?.pack ?? '');
  const selected = product.prices.find(price => price.pack === pack) ?? product.prices.find(price => price.priceSatang > 0);
  const available = selected && selected.priceSatang > 0 && product.available !== null && product.available >= selected.grams;

  return <article className="shop-product">
    <div className="shop-product-picture">
      {product.imageVersion
        ? <img src={imageUrl(product)} alt={'รูปสินค้า ' + product.code} loading="lazy" width={240} height={240}/>
        : <span>ไม่มีรูปสินค้า</span>}
    </div>
    <div className="shop-product-details">
      <span className="shop-product-code">{product.code}</span>
      <h3>{product.name || product.code}</h3>
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
      <button type="button" aria-label={'เพิ่มลงตะกร้า ' + product.code} disabled={disabled || !available} onClick={() => selected && onAdd(product, selected.pack)}>
        เพิ่มลงตะกร้า
      </button>
    </div>
  </article>;
}

export function CustomerShop({customerCode, initialCatalog, readOnly = false}: {
  customerCode: string;
  initialCatalog: CustomerCatalog;
  readOnly?: boolean;
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [cart, setCart] = useState<{key: string | null; items: CustomerCartItem[]}>({key: null, items: []});
  const cartDialog = useRef<HTMLDialogElement>(null);
  const storageKey = readOnly ? null : 'cannexa:shop-cart:v1:' + customerCode;
  const ready = cart.key === storageKey;
  const items = ready ? cart.items : [];
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const products = new Map(catalog.products.map(product => [product.code, product]));

  useEffect(() => setCatalog(initialCatalog), [initialCatalog]);
  useEffect(() => {
    let saved: CustomerCartItem[] = [];
    if (storageKey) {
      try { saved = readCustomerCart(localStorage.getItem(storageKey)); } catch {}
    }
    setCart({key: storageKey, items: saved});
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey || cart.key !== storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(cart.items)); } catch {}
  }, [cart, storageKey]);

  function add(product: CustomerCatalogProduct, pack: string) {
    const price = product.prices.find(candidate => candidate.pack === pack);
    if (!price || !ready || readOnly) return;
    const key = cartItemKey({code: product.code, pack});
    const existing = items.find(item => cartItemKey(item) === key);
    const quantity = (existing?.quantity ?? 0) + 1;
    const problem = cartQuantityError(items, product, price, quantity);
    if (problem) { setError(problem); return; }
    if (!existing && items.length >= 100) { setError('ตะกร้ารองรับได้ไม่เกิน 100 รายการ'); return; }
    setCart({key: storageKey, items: existing
      ? items.map(item => cartItemKey(item) === key ? {...item, quantity} : item)
      : [...items, {code: product.code, pack, quantity}]});
    setError('');
  }

  function setQuantity(item: CustomerCartItem, quantity: number) {
    const product = products.get(item.code);
    const price = product?.prices.find(candidate => candidate.pack === item.pack);
    if (!product || !price || readOnly) return;
    const problem = cartQuantityError(items, product, price, quantity);
    if (problem) { setError(problem); return; }
    setCart({key: storageKey, items: items.map(candidate => cartItemKey(candidate) === cartItemKey(item) ? {...candidate, quantity} : candidate)});
    setError('');
  }

  const search = query.trim().normalize('NFKC').toLocaleLowerCase();
  const visibleProducts = catalog.products.filter(product => (product.code + ' ' + (product.name ?? '')).normalize('NFKC').toLocaleLowerCase().includes(search));
  const total = items.reduce((sum, item) => {
    const price = products.get(item.code)?.prices.find(candidate => candidate.pack === item.pack);
    return sum + (price?.priceSatang ?? 0) * item.quantity;
  }, 0);

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
    {readOnly && <p className="portal-muted">โหมดเจ้าของระบบสำหรับดูตัวอย่างหน้าลูกค้า</p>}
    {error && <p className="portal-alert" role="alert">{error}</p>}
    <div className="shop-product-grid">
      {visibleProducts.map(product => <ShopProduct key={product.code} product={product} disabled={!ready || readOnly} onAdd={add}/>)}
    </div>
    {!visibleProducts.length && <p className="portal-empty">{query ? 'ไม่พบสินค้าที่ค้นหา' : 'ยังไม่มีสินค้าในรายการ'}</p>}
    <dialog className="stock-modal shop-cart-dialog" ref={cartDialog} aria-labelledby="shop-cart-title">
      <div className="shop-heading"><h2 id="shop-cart-title">ตะกร้า</h2><button type="button" className="secondary" onClick={() => cartDialog.current?.close()}>ปิด</button></div>
      {error && <p className="portal-alert" role="alert">{error}</p>}
      {items.length ? <div className="shop-cart-items">{items.map(item => {
        const product = products.get(item.code);
        const price = product?.prices.find(candidate => candidate.pack === item.pack);
        const problem = product && price ? cartQuantityError(items, product, price, item.quantity) : 'สินค้าขนาดนี้ไม่อยู่ในรายการล่าสุด';
        return <article key={cartItemKey(item)} className="shop-cart-item">
          <div><strong>{product?.name || item.code}</strong><p>{item.code} · {item.pack}</p>{price && <span>{money(price.priceSatang)} บาท / ชิ้น</span>}</div>
          <label>จำนวน<input type="number" min={1} max={999} step={1} aria-label={'จำนวน ' + item.code + ' ' + item.pack} value={item.quantity} disabled={readOnly || !price} onChange={event => setQuantity(item, Number(event.target.value))}/></label>
          <strong>{price ? money(price.priceSatang * item.quantity) + ' บาท' : 'รอราคา'}</strong>
          <button type="button" className="secondary" aria-label={'ลบ ' + item.code + ' ' + item.pack} disabled={readOnly} onClick={() => {
            setCart({key: storageKey, items: items.filter(candidate => cartItemKey(candidate) !== cartItemKey(item))});
            setError('');
          }}>นำออก</button>
          {problem && <p className="shop-cart-warning">{problem}</p>}
        </article>;
      })}</div> : <p className="portal-empty">ยังไม่มีสินค้าในตะกร้า</p>}
      <div className="shop-cart-total"><span>ยอดรวมสินค้า</span><strong>{Number.isSafeInteger(total) ? money(total) + ' บาท' : 'กรุณาตรวจสอบยอดรวม'}</strong></div>
      <p className="portal-muted">ตะกร้าสำหรับจัดรายการสินค้าและดูยอดรวม</p>
      {items.length > 0 && !readOnly && <button type="button" className="secondary" onClick={() => {setCart({key: storageKey, items: []}); setError('');}}>ล้างตะกร้า</button>}
    </dialog>
  </section>;
}
