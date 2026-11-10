import {withShopWorkspace} from '@/lib/shop-workspace';
import {shopPath} from '@/lib/shop-session';
import {roles} from '@/lib/accounts';
import {userSaveErrors} from '@/lib/user-save-errors';
import {UserForm} from '@/app/admin/users/user-form';
import {ShopWorkspaceNav} from '../workspace-nav';
const labels={admin:'แอดมิน',manager:'ผู้จัดการ',viewer:'ผู้ดูรายงาน',employee:'พนักงานขาย',sales:'เซลล์',store:'พนักงานสโตร์'};
export default async function Users({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{status?:string;reason?:string}>}){
 const {slug}=await params,{status,reason}=await searchParams;
 const {shop,users,affiliates}=await withShopWorkspace(slug,async({shop,client})=>({shop,users:await client.userAccount.findMany({where:{role:{not:'owner'}},select:{username:true,role:true,active:true,affiliateId:true},orderBy:{username:'asc'}}),affiliates:await client.affiliate.findMany({where:{archivedAt:null},select:{id:true,name:true,code:true},orderBy:{name:'asc'}})}));
 const path=shopPath(slug),options=roles.map(value=>({value,label:labels[value]}));
 return <main className="main"><h1>พนักงานและทีม · {shop.name}</h1><ShopWorkspaceNav slug={slug}/>{status&&<p role="status" className="notice">{status==='saved'?'บันทึกเรียบร้อยแล้ว':userSaveErrors[reason??'']??'บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูล'}</p>}<section className="card"><h2>เพิ่มทีมขาย</h2><form action={path+'/users/team'} method="post" className="form-grid"><label>รหัสทีม<input name="code" required pattern="[A-Z0-9_-]{3,30}"/></label><label>ชื่อทีม<input name="name" required maxLength={100}/></label><div><button>เพิ่มทีม</button></div></form><p>{affiliates.map(team=>team.name+' ('+team.code+')').join(' · ')||'ยังไม่มีทีมขาย'}</p></section><section className="card"><h2>เพิ่มพนักงาน</h2><UserForm affiliates={affiliates} roleOptions={options} action={path+'/users/save'}/></section>{users.map(user=><section className="card" key={user.username}><h2>{user.username}</h2><UserForm user={user} affiliates={affiliates} roleOptions={options} action={path+'/users/save'}/></section>)}</main>;
}
