import {metaAdCode} from "@/lib/meta-ad";
import {requireAdminPage} from "@/lib/auth";
import {db} from "@/lib/db";
import {roles} from "@/lib/accounts";

const labels={admin:"แอดมินอนุมัติค่าคอม",manager:"ผู้จัดการ Affiliate",viewer:"ผู้ดูรายงาน",employee:"พนักงาน"};
type User={username:string;role:string;active:boolean;affiliateId:string|null};
type Affiliate={id:string;name:string;code:string};
function UserForm({user,affiliates}:{user?:User;affiliates:Affiliate[]}){
 return <form action="/api/admin/users" method="post">
 <input type="hidden" name="action" value={user?"edit":"create"}/>
 <label>ชื่อผู้ใช้<input name="username" defaultValue={user?.username} readOnly={!!user} required maxLength={64}/></label>
 <label>บทบาท<select name="role" defaultValue={user?.role??"employee"}>{roles.map(role=><option key={role} value={role}>{labels[role]}</option>)}</select></label>
 <label>Affiliate สำหรับพนักงาน<select name="affiliateId" defaultValue={user?.affiliateId??""}><option value="">เลือก Affiliate</option>{affiliates.map(a=><option value={a.id} key={a.id}>{a.name} ({a.code})</option>)}</select></label>
 <label>{user?"รหัสผ่านใหม่ (เว้นว่างเพื่อใช้รหัสเดิม)":"รหัสผ่านเริ่มต้น"}<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={256} required={!user}/></label>
 <label><input type="checkbox" name="active" defaultChecked={user?.active??true}/> เปิดใช้งาน</label>
 <button>{user?"บันทึกสิทธิ์และรหัสผ่าน":"เพิ่มผู้ใช้"}</button></form>;
}
export default async function Users({searchParams}:{searchParams:Promise<{status?:string}>}){
 await requireAdminPage();
 const [{status},users,affiliates]=await Promise.all([searchParams,db.userAccount.findMany({where:{username:{not:"owner"}},select:{username:true,role:true,active:true,affiliateId:true},orderBy:{username:"asc"}}),db.affiliate.findMany({where:{code:{not:metaAdCode},archivedAt:null},select:{id:true,name:true,code:true},orderBy:{name:"asc"}})]);
 return <><h1>จัดการผู้ใช้</h1>{status==="saved"&&<p role="status">บันทึกแล้ว</p>}{status==="error"&&<p role="alert">บันทึกไม่ได้ ตรวจชื่อผู้ใช้ซ้ำ รหัสผ่านอย่างน้อย 8 ตัวอักษร และ Affiliate ของพนักงาน</p>}
 {status==="deleted"&&<p role="status">ลบบัญชีพนักงานแล้ว</p>}{status==="delete-error"&&<p role="alert">ลบบัญชีไม่ได้ กรุณาลองอีกครั้ง</p>}
 {status==="renamed"&&<p role="status">เปลี่ยนชื่อผู้ใช้แล้ว ให้พนักงานเข้าสู่ระบบด้วยชื่อใหม่และรหัสผ่านเดิม</p>}{status==="rename-error"&&<p role="alert">เปลี่ยนชื่อไม่ได้ ชื่อต้องไม่ซ้ำ ใช้อักษรอังกฤษตัวเล็ก ตัวเลข จุด ขีดกลาง หรือขีดล่าง 3–64 ตัว และห้ามใช้ชื่อ owner</p>}
 <section className="card"><h2>เพิ่มผู้ใช้</h2><UserForm affiliates={affiliates}/></section>
 {users.map(user=><section className="card" key={user.username}><h2>{user.username} · {labels[user.role as keyof typeof labels]}</h2><details><summary>แก้ไขบัญชีและรหัสผ่าน</summary><UserForm user={user} affiliates={affiliates}/></details>
 <details><summary>เปลี่ยนชื่อผู้ใช้</summary><form action="/api/admin/users/rename" method="post"><input type="hidden" name="originalUsername" value={user.username}/><label>ชื่อผู้ใช้ใหม่<input name="newUsername" required pattern="[a-z0-9._-]{3,64}" minLength={3} maxLength={64} defaultValue={user.username}/></label><p className="muted">รหัสผ่าน สิทธิ์ และ Affiliate เดิมยังคงอยู่ ผู้ใช้นี้ต้องเข้าสู่ระบบใหม่ และข้อความส่งงานถัดไปให้ใช้ชื่อใหม่หรือรหัส Affiliate เดิม</p><button>บันทึกชื่อผู้ใช้ใหม่</button></form></details>
 {user.role==="employee"&&<div>{user.affiliateId&&<p><a className="button secondary" href={"/admin/affiliates#"+encodeURIComponent(user.affiliateId)}>ตั้งค่าคอมยอดโอน / COD</a></p>}
  <p>บัญชีนี้จะเข้าสู่ระบบไม่ได้หลังลบ ข้อมูล Affiliate และผลงานยังดูย้อนหลังได้</p>
  <form action="/api/admin/users/delete" method="post">
   <input type="hidden" name="username" value={user.username}/>
   <label><input type="checkbox" name="confirm" value="yes" required/> ยืนยันลบบัญชี {user.username}</label>
   <button type="submit">ลบบัญชีพนักงาน</button>
  </form>
 </div>}
 </section>)}</>;
}
