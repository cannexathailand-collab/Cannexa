'use client';
import {useState} from 'react';
type Props={id?:string;requestKey:string;name?:string;from:string;to:string;minimum?:number;type?:string;value?:number;enabled?:boolean;editable:boolean;rates:{name:string;rate:number}[]};
export function CrmPromotionEditor(p:Props){
 const [kind,setKind]=useState(p.type??'PERCENT'),[minimum,setMinimum]=useState(String(p.minimum??3000)),[value,setValue]=useState(String(p.value??70)),[enabled,setEnabled]=useState(p.enabled??false),[from,setFrom]=useState(p.from),[to,setTo]=useState(p.to);
 const amount=Math.max(0,Number(minimum)||0),bonus=Math.max(0,Number(value)||0),fmt=(n:number)=>n.toLocaleString('th-TH',{maximumFractionDigits:2});
 return <form action="/api/admin/crm/promotions" method="post" className="loyalty-editor"><input type="hidden" name="requestKey" value={p.requestKey}/>{p.id&&<input type="hidden" name="id" value={p.id}/>}
 <fieldset disabled={!p.editable} className="loyalty-fields"><div className="loyalty-editor-grid"><div>
 <div className="loyalty-step"><span>1</span><h3>ตั้งชื่อและช่วงเวลา</h3></div>
 <label>ชื่อโปรโมชั่น<input name="name" required maxLength={120} defaultValue={p.name??''} placeholder="เช่น โบนัสพิเศษเดือนนี้"/></label>
 <div className="loyalty-pair"><label>เริ่มวันที่<input type="date" name="from" required value={from} onChange={e=>setFrom(e.target.value)}/></label><label>ถึงวันที่<input type="date" name="to" min={from} required value={to} onChange={e=>setTo(e.target.value)}/></label></div>
 {to&&from&&to<from&&<p className="loyalty-validation" role="alert">เลือกวันสิ้นสุดให้ตรงกับหรือหลังวันเริ่มต้น</p>}
 <div className="loyalty-step"><span>2</span><h3>กำหนดโบนัสที่ลูกค้าจะได้รับ</h3></div>
 <label>ยอดซื้อขั้นต่ำต่อออเดอร์ (บาท)<input type="number" name="minimumBaht" min="0.01" max="21474836.47" step="0.01" required value={minimum} onChange={e=>setMinimum(e.target.value)}/></label>
 <input type="hidden" name="bonusType" value={kind}/>
 <div className="loyalty-kind" role="group" aria-label="ชนิดโบนัส"><button type="button" aria-pressed={kind==='PERCENT'} onClick={()=>setKind('PERCENT')}><b>เพิ่มเป็นเปอร์เซ็นต์</b><small>คูณเพิ่มจากแต้มปกติ</small></button><button type="button" aria-pressed={kind==='POINTS'} onClick={()=>setKind('POINTS')}><b>เพิ่มเป็นจำนวนแต้ม</b><small>รับโบนัสตามจำนวนที่ตั้ง</small></button></div>
 <label>{kind==='PERCENT'?'โบนัสเพิ่ม (%)':'แต้มโบนัสเพิ่ม (แต้ม)'}<input type="number" name="bonusValue" min="1" max={kind==='PERCENT'?1000:1000000} step="1" required value={value} onChange={e=>setValue(e.target.value)}/><small className="loyalty-field-hint">{kind==='PERCENT'?'เช่น 70 คือเพิ่มอีก 70% จากแต้มปกติ':'จำนวนแต้มที่ให้เพิ่มต่อออเดอร์ที่เข้าเงื่อนไข'}</small></label>
 </div><aside className="loyalty-preview" aria-label="ตัวอย่างแต้มที่จะได้รับ" aria-live="polite"><span className="loyalty-overline">ตัวอย่างการรับแต้ม</span><div className="loyalty-bonus">+{fmt(bonus)}<small>{kind==='PERCENT'?'%':' แต้ม'}</small></div><p>เมื่อซื้อครบ <strong>{fmt(amount)} บาท</strong><br/>รับเพิ่มจากแต้มปกติของแต่ละระดับ</p><div className="loyalty-preview-table"><div className="loyalty-preview-labels"><span>ระดับสมาชิก</span><span>ปกติ + โบนัส = รวม</span></div>{p.rates.map(r=>{const base=Math.floor(amount*r.rate/1000),extra=kind==='PERCENT'?Math.floor(base*bonus/100):bonus;return <div key={r.name}><span>{r.name}</span><span>{fmt(base)} <i>+ {fmt(extra)}</i> = <strong>{fmt(base+extra)}</strong></span></div>;})}</div><small>อ้างอิงอัตราแต้มปกติที่บันทึกแล้ว<br/>ให้แต้มเมื่อซื้อสำเร็จและเปิดสะสมแต้ม</small></aside></div>
 <div className="loyalty-editor-footer"><label className="loyalty-toggle"><input type="checkbox" name="enabled" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/><span className="loyalty-switch" aria-hidden="true"/><span><b>{enabled?'เปิดใช้โปรโมชั่น':'บันทึกไว้ก่อน ยังไม่เปิดใช้'}</b><small>{enabled?'เริ่มให้โบนัสตามช่วงวันที่กำหนด':'เปิดใช้ภายหลังได้ทุกเมื่อ'}</small></span></label><button type="submit">{p.id?'บันทึกการเปลี่ยนแปลง':'สร้างโปรโมชั่น'}</button></div>
 </fieldset></form>;
}
