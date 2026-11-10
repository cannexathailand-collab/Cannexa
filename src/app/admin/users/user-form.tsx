'use client';
import {useState} from 'react';
type User={username:string;role:string;active:boolean;affiliateId:string|null};
type Affiliate={id:string;name:string;code:string};
export function UserForm({user,affiliates,roleOptions}:{user?:User;affiliates:Affiliate[];roleOptions:{value:string;label:string}[]}){
 const [role,setRole]=useState(user?.role??'employee');
 const needsAffiliate=role==='employee'||role==='sales';
 return <form action="/api/admin/users" method="post" className="form-grid">
  <input type="hidden" name="action" value={user?'edit':'create'}/>
  <label>ชื่อผู้ใช้<input name="username" defaultValue={user?.username} readOnly={!!user} required minLength={3} maxLength={64} pattern="[a-zA-Z0-9._\-]{3,64}" autoCapitalize="none" autoComplete="off" title="ใช้อักษรอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง 3–64 ตัว"/><small>ใช้อักษรอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง 3–64 ตัว</small></label>
  <label>บทบาท<select name="role" value={role} onChange={event=>setRole(event.target.value)}>{roleOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
  {needsAffiliate&&<label>Affiliate สำหรับบัญชีขาย (จำเป็น)<select name="affiliateId" defaultValue={user?.affiliateId??''} required><option value="">เลือก Affiliate</option>{affiliates.map(affiliate=><option value={affiliate.id} key={affiliate.id}>{affiliate.name} ({affiliate.code})</option>)}</select><small>{affiliates.length?'เลือก Affiliate เพื่อผูกผลงานกับบัญชีขายนี้':'สร้าง Affiliate ในเมนูตั้งค่า Affiliate ก่อนเพิ่มบัญชีขาย'}</small></label>}
  <label>{user?'รหัสผ่านใหม่ (เว้นว่างเพื่อใช้รหัสเดิม)':'รหัสผ่านเริ่มต้น'}<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={256} required={!user}/><small>อย่างน้อย 8 ตัวอักษร</small></label>
  <label className="user-active-toggle"><input type="checkbox" name="active" defaultChecked={user?.active??true}/> เปิดใช้งาน</label>
  <div className="wide user-form-actions"><button>{user?'บันทึกสิทธิ์และรหัสผ่าน':'เพิ่มผู้ใช้'}</button></div>
 </form>;
}
