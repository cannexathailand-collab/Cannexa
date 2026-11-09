'use client';
import {useRef,useState} from 'react';
import Link from 'next/link';

type Props={groups:{id:string;name:string}[];sellers:{username:string}[];customers:{code:string;name:string|null;phone:string|null;address:string|null}[];products:{code:string;name:string|null}[]};
export function ManualOrderForm({groups,sellers,customers,products}:Props){
 const [customerCode,setCustomerCode]=useState(''),[recipient,setRecipient]=useState(''),[phone,setPhone]=useState(''),[address,setAddress]=useState('');
 const [items,setItems]=useState([{code:'',grams:''}]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [saved,setSaved]=useState<{orderId:string;orderNumber:string;status:string}|null>(null);
 const key=useRef(''),sending=useRef(false);
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(sending.current)return;
  const form=new FormData(event.currentTarget);key.current||=crypto.randomUUID();
  sending.current=true;setBusy(true);setError('');
  try{
   const response=await fetch('/api/admin/orders/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestKey:key.current,groupId:form.get('groupId'),sellerCode:form.get('sellerCode'),customerCode,recipient,phone,address,payment:form.get('payment'),amountSatang:Math.round(Number(form.get('amount'))*100),items:items.map(item=>({code:item.code,grams:Number(item.grams)}))}),signal:AbortSignal.timeout(60000)});
   const result=await response.json();if(!response.ok){key.current='';throw Error(result.error);}
   setSaved(result);
  }catch(failure){setError(failure instanceof Error?failure.message:'ยังยืนยันผลไม่ได้ กรุณาลองส่งอีกครั้ง');}finally{sending.current=false;setBusy(false);}
 }
 function selectCustomer(code:string){
  setCustomerCode(code);const customer=customers.find(item=>item.code===code);
  if(customer){setRecipient(customer.name??'');setPhone(customer.phone??'');setAddress(customer.address??'');}
 }
 if(saved)return <section className="card"><p role="status">บันทึกออเดอร์ {saved.orderNumber} แล้ว{saved.status==='NEEDS_REVIEW'?' · มีข้อมูลที่ต้องตรวจสอบ':''}</p><Link className="button" href={'/admin/orders/list/'+saved.orderId}>เปิดออเดอร์</Link><Link className="button secondary" href="/admin/orders/list">รายการออเดอร์</Link></section>;
 return <form className="card" onSubmit={save} onChange={()=>{if(!sending.current)key.current='';}}>
  <fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
   <label>ทีม / บ้าน<select name="groupId" required defaultValue=""><option value="" disabled>เลือกทีม</option>{groups.map(group=><option key={group.id} value={group.id}>{group.name||'กลุ่มยังไม่ตั้งชื่อ'}</option>)}</select></label>
   <label>ผู้ขาย<input name="sellerCode" list="manual-sellers" required placeholder="ชื่อผู้ใช้หรือรหัสผู้ขาย"/></label><datalist id="manual-sellers">{sellers.map(seller=><option key={seller.username} value={seller.username}/>)}</datalist>
   <label>รหัสลูกค้า<input value={customerCode} onChange={event=>selectCustomer(event.target.value)} list="manual-customers" required/></label><datalist id="manual-customers">{customers.map(customer=><option key={customer.code} value={customer.code}>{customer.name??''}</option>)}</datalist>
   <label>ชื่อผู้รับ<input value={recipient} onChange={event=>setRecipient(event.target.value)} required/></label>
   <label>เบอร์โทร<input type="tel" value={phone} onChange={event=>setPhone(event.target.value)} required/></label>
   <label>ที่อยู่จัดส่ง<textarea value={address} onChange={event=>setAddress(event.target.value)} required rows={3}/></label>
   <h2>สินค้า</h2><datalist id="manual-products">{products.map(product=><option key={product.code} value={product.code}>{product.name??product.code}</option>)}</datalist>
   {items.map((item,index)=><div key={index} className="actions">
    <label>รหัสสินค้า {index+1}<input list="manual-products" value={item.code} onChange={event=>setItems(items.map((value,i)=>i===index?{...value,code:event.target.value}:value))} required/></label>
    <label>จำนวนกรัม {index+1}<input type="number" min="0.001" max="999999" step="0.001" value={item.grams} onChange={event=>setItems(items.map((value,i)=>i===index?{...value,grams:event.target.value}:value))} required/></label>
    {items.length>1&&<button type="button" className="secondary" onClick={()=>{key.current='';setItems(items.filter((_,i)=>i!==index));}}>ลบรายการ {index+1}</button>}
   </div>)}
   <button type="button" className="secondary" disabled={items.length>=50} onClick={()=>{key.current='';setItems([...items,{code:'',grams:''}]);}}>เพิ่มสินค้า</button>
   <label>ชำระเงิน<select name="payment"><option value="COD">COD</option><option value="โอน">โอน</option></select></label>
   <label>ยอดรวมที่เรียกเก็บ รวมค่าส่ง (บาท)<input name="amount" type="number" min="0.01" step="0.01" required/></label>
   {error&&<p role="alert" className="notice" style={{whiteSpace:'pre-line'}}>{error}</p>}
   <div className="actions"><button type="submit">{busy?'กำลังบันทึก…':'บันทึกออเดอร์'}</button><Link className="button secondary" href="/admin/orders/list">กลับรายการออเดอร์</Link></div>
  </fieldset>
 </form>;
}
