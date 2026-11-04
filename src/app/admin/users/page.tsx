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
 <label>{user?"รหัสผ่านใหม่ (เว้นว่างเพื่อใช้รหัสเดิม)":"รหัสผ่านเริ่มต้น"}<input name="password" type="password" autoComplete="new-password" minLength={16} maxLength={256} required={!user}/></label>
 <label><input type="checkbox" name="active" defaultChecked={user?.active??true}/> เปิดใช้งาน</label>
 <button>{user?"บันทึกสิทธิ์และรหัสผ่าน":"เพิ่มผู้ใช้"}</button></form>;
}
export default async function Users({searchParams}:{searchParams:Promise<{status?:string}>}){
 await requireAdminPage();
 const [{status},users,affiliates]=await Promise.all([searchParams,db.userAccount.findMany({where:{username:{not:"owner"}},select:{username:true,role:true,active:true,affiliateId:true},orderBy:{username:"asc"}}),db.affiliate.findMany({select:{id:true,name:true,code:true},orderBy:{name:"asc"}})]);
 return <><h1>จัดการผู้ใช้</h1>{status==="saved"&&<p role="status">บันทึกแล้ว</p>}{status==="error"&&<p role="alert">บันทึกไม่ได้ ตรวจชื่อผู้ใช้ซ้ำ รหัสผ่านอย่างน้อย 16 ตัวอักษร และ Affiliate ของพนักงาน</p>}
 <section className="card"><h2>เพิ่มผู้ใช้</h2><UserForm affiliates={affiliates}/></section>
 {users.map(user=><details className="card" key={user.username}><summary>{user.username} · {labels[user.role as keyof typeof labels]}</summary><UserForm user={user} affiliates={affiliates}/></details>)}</>;
}
