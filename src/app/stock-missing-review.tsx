'use client';
import {useState} from 'react';
import Link from 'next/link';
import {StockAddForm} from './stock-add-form';
import type {StockFormProduct} from '@/lib/stock-form-match';
type Missing={code:string;requestKey:string;orders:{id:string;number:string}[]};
export function StockMissingReview({missing,catalog,enabled}:{missing:Missing[];catalog:StockFormProduct[];enabled:boolean}){
 const [skipped,setSkipped]=useState<string[]>([]);
 if(!enabled||!missing.length)return null;
 return <section className="card" aria-label="ตรวจสอบรหัสสินค้าที่ไม่พบ"><h2>มีรหัสสินค้าที่ต้องตรวจสอบ</h2><p>เลือกรหัสเพื่อเพิ่มสินค้าใหม่ หรือข้ามไว้ก่อน ออเดอร์จะยังเก็บไว้และยังไม่ตัดสต๊อก</p>{missing.map(item=><div className="notice" key={item.code}><strong>{item.code}</strong> · {item.orders.length} ออเดอร์{skipped.includes(item.code)?<p>ข้ามไว้ก่อน <button type="button" className="secondary" onClick={()=>setSkipped(items=>items.filter(code=>code!==item.code))}>เปิดตรวจสอบ</button></p>:<><p>{item.orders.map((order,index)=><span key={order.id}>{index>0?' · ':''}<Link href={'/admin/orders/'+encodeURIComponent(order.id)+'/review'}>{order.number}</Link></span>)}</p><div className="actions"><StockAddForm requestKey={item.requestKey} enabled={enabled} catalog={catalog} initialCode={item.code} buttonLabel="เพิ่มสินค้าใหม่"/><button type="button" className="secondary" onClick={()=>setSkipped(items=>[...items,item.code])}>ข้ามไว้ก่อน</button></div></>}</div>)}</section>;
}
