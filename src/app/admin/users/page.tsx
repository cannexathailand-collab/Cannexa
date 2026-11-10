import './user-management.css';
import {UserForm} from './user-form';
import {userSaveErrors} from '@/lib/user-save-errors';
import {PopupDetails} from '@/app/popup-details';
import {metaAdCode} from "@/lib/meta-ad";
import {requireAdminPage} from "@/lib/auth";
import {db} from "@/lib/db";
import {roles,isEmployeeRole} from "@/lib/accounts";

const labels={admin:"แอดมินอนุมัติค่าคอม",manager:"ผู้จัดการ Affiliate",viewer:"ผู้ดูรายงาน",employee:"พนักงานขายแอดมินประจำ",sales:"เซลล์ Affiliate",store:"พนักงานสโตร์ / ผู้ดูแลสินค้า"};
export default async function Users({searchParams}:{searchParams:Promise<{status?:string;reason?:string}>}){
 await requireAdminPage();
 const [{status,reason},users,affiliates]=await Promise.all([searchParams,db.userAccount.findMany({where:{username:{not:"owner"}},select:{username:true,role:true,active:true,affiliateId:true},orderBy:{username:"asc"}}),db.affiliate.findMany({where:{code:{not:metaAdCode},archivedAt:null},select:{id:true,name:true,code:true},orderBy:{name:"asc"}})]);
 const affiliateNames=new Map(affiliates.map(affiliate=>[affiliate.id,affiliate.name]));
 return <><header className="user-page-header"><div><h1>จัดการผู้ใช้</h1><p>บัญชีผู้ใช้ {users.length} บัญชี · กำหนดบทบาทและ Affiliate ของแต่ละคน</p></div><PopupDetails className="user-create" summary={<>เพิ่มผู้ใช้</>}><UserForm affiliates={affiliates} roleOptions={roles.map(value=>({value,label:labels[value]}))}/></PopupDetails></header>{status==="saved"&&<p role="status">บันทึกแล้ว</p>}{status==="error"&&<p role="alert">{userSaveErrors[reason??'']??'บันทึกผู้ใช้ไม่สำเร็จ กรุณาลองอีกครั้ง'}</p>}
 {status==="deleted"&&<p role="status">ลบบัญชีผู้ใช้แล้ว</p>}{status==="delete-error"&&<p role="alert">ลบบัญชีไม่ได้ กรุณาลองอีกครั้ง</p>}
 {status==="renamed"&&<p role="status">เปลี่ยนชื่อผู้ใช้แล้ว ให้พนักงานเข้าสู่ระบบด้วยชื่อใหม่และรหัสผ่านเดิม</p>}{status==="rename-error"&&<p role="alert">เปลี่ยนชื่อไม่ได้ ชื่อต้องไม่ซ้ำ ใช้อักษรอังกฤษตัวเล็ก ตัวเลข จุด ขีดกลาง หรือขีดล่าง 3–64 ตัว และห้ามใช้ชื่อ owner</p>}
 <div className="user-account-list">
 {users.map(user=><section className="user-account-card" key={user.username}><header className="user-account-heading"><span className="user-avatar" aria-hidden="true">{user.username.slice(0,2).toUpperCase()}</span><div className="user-account-identity"><h2>{user.username}</h2><p>{labels[user.role as keyof typeof labels]}{user.affiliateId&&<span> · {affiliateNames.get(user.affiliateId)??"Affiliate"}</span>}</p></div><span className={"user-status "+(user.active?"is-active":"is-inactive")}><i aria-hidden="true"/>{user.active?"เปิดใช้งาน":"ปิดใช้งาน"}</span></header><div className="user-account-actions"><PopupDetails summary={<>แก้ไขบัญชี</>} title={"แก้ไขบัญชี · "+user.username}><UserForm user={user} affiliates={affiliates} roleOptions={roles.map(value=>({value,label:labels[value]}))}/></PopupDetails>
 <PopupDetails summary={<>เปลี่ยนชื่อผู้ใช้</>} title={"เปลี่ยนชื่อผู้ใช้ · "+user.username}><form action="/api/admin/users/rename" method="post"><input type="hidden" name="originalUsername" value={user.username}/><label>ชื่อผู้ใช้ใหม่<input name="newUsername" required pattern="[a-z0-9._-]{3,64}" minLength={3} maxLength={64} defaultValue={user.username}/></label><p className="muted">รหัสผ่าน สิทธิ์ และ Affiliate เดิมยังคงอยู่ ผู้ใช้นี้ต้องเข้าสู่ระบบใหม่ และข้อความส่งงานถัดไปให้ใช้ชื่อใหม่หรือรหัส Affiliate เดิม</p><button>บันทึกชื่อผู้ใช้ใหม่</button></form></PopupDetails>
 {(isEmployeeRole(user.role)||user.role==='store')&&<>{user.affiliateId&&<a className="button secondary user-commission" href={"/admin/affiliates#"+encodeURIComponent(user.affiliateId)}>ตั้งค่าคอมมิชชัน</a>}
  <PopupDetails className="admin-danger" summary={<>ลบบัญชี</>} title={"ลบบัญชี · "+user.username}><p>บัญชีนี้จะเข้าสู่ระบบไม่ได้หลังลบ ข้อมูล Affiliate และผลงานยังดูย้อนหลังได้</p>
  <form action="/api/admin/users/delete" method="post">
   <input type="hidden" name="username" value={user.username}/>
   <label><input type="checkbox" name="confirm" value="yes" required/> ยืนยันลบบัญชี {user.username}</label>
   <button type="submit">ลบบัญชีพนักงาน</button>
  </form></PopupDetails>
 </>}
 </div></section>)}</div></>;
}
