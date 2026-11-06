import {db} from '@/lib/db';
import {managers} from '@/lib/accounts';
import {requireAdminPage} from '@/lib/auth';
import {AutoFilterForm} from '@/app/auto-filter-form';
export default async function Customers({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 await requireAdminPage(managers);
 const p=await searchParams,q=typeof p.q==='string'?p.q.trim().slice(0,100):'',page=Math.max(1,Math.min(100000,Math.trunc(Number(p.page))||1));
 const where={source:'LINE',...(q?{OR:[{customerCode:{contains:q,mode:'insensitive' as const}},{affiliate:{code:{contains:q,mode:'insensitive' as const}}}]}:{})};
 const [rows,count]=await Promise.all([db.conversion.findMany({where,include:{affiliate:{select:{name:true,code:true}}},orderBy:{customerCode:'asc'},skip:(page-1)*100,take:100}),db.conversion.count({where})]);
 return <><h1>รหัสลูกค้า</h1><p>ออกอัตโนมัติเมื่อลูกค้าเข้าสู่ระบบ LINE ครั้งแรก ใช้รหัสเดิมเมื่อกลับมาอีก และเก็บผู้แนะนำเดิมไว้ ลูกค้าเก่าที่มีตัวตน LINE ในระบบได้รับรหัสอัตโนมัติแล้ว</p><AutoFilterForm action="/admin/customers"><label>ค้นหารหัสลูกค้าหรือรหัสผู้แนะนำ<input name="q" defaultValue={q}/></label></AutoFilterForm><p>พบ {count.toLocaleString('th-TH')} รายการ</p><section className="card"><div className="table-wrap"><table><thead><tr><th>รหัสลูกค้า</th><th>ผู้แนะนำเดิม</th><th>สถานะเพิ่มเพื่อน</th><th>วันที่เข้าระบบ</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><th scope="row">{r.customerCode}</th><td>{r.affiliate.name} · {r.affiliate.code}</td><td>{r.friendFlag===true?'เป็นเพื่อน':r.friendFlag===false?'ยังไม่เป็นเพื่อน':'รอตรวจสอบ'}</td><td>{r.createdAt.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'})}</td></tr>)}</tbody></table></div>{!rows.length&&<p>ไม่พบลูกค้าในรายการนี้</p>}</section><div className="filters">{page>1&&<a href={'?'+new URLSearchParams({q,page:String(page-1)})}>หน้าก่อน</a>}{page*100<count&&<a href={'?'+new URLSearchParams({q,page:String(page+1)})}>หน้าถัดไป</a>}</div><p className="muted">รหัสลูกค้าใช้ระบุตัวตนและผู้แนะนำ ไม่ได้ทำให้เกิดสิทธิ์ค่าคอมใหม่ และยังไม่ได้ผูกออเดอร์เก่าที่ไม่ทราบตัวตนลูกค้าโดยอัตโนมัติ</p></>;
}
