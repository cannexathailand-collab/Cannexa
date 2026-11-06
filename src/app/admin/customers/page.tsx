import {db} from '@/lib/db';
import {customerOrderTeams} from '@/lib/customer-order-teams';
import {customerTags} from '@/lib/customer-tags';
import {managers} from '@/lib/accounts';
import {requireAdminPage} from '@/lib/auth';
import {AutoFilterForm} from '@/app/auto-filter-form';
export default async function Customers({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 await requireAdminPage(managers);
 const p=await searchParams,q=typeof p.q==='string'?p.q.trim().slice(0,100):'',page=Math.max(1,Math.min(100000,Math.trunc(Number(p.page))||1));
 const where={AND:[{OR:[{conversionId:null},{conversion:{source:'LINE'}}]},...(q?[{OR:[{code:{contains:q,mode:'insensitive' as const}},{name:{contains:q,mode:'insensitive' as const}},{phone:{contains:q}},{referrer:{code:{contains:q,mode:'insensitive' as const}}}]}]:[])]};
 const [rows,count]=await Promise.all([db.customer.findMany({where,include:{referrer:{select:{name:true,code:true}},orders:{select:{groupKey:true},orderBy:{createdAt:'asc'}},_count:{select:{orders:true}}},orderBy:{code:'asc'},skip:(page-1)*100,take:100}),db.customer.count({where})]);
 const deliveries=await db.customerCodeDelivery.findMany({where:{customerCode:{in:rows.map(r=>r.code)}},select:{customerCode:true,status:true}}),deliveryByCode=new Map(deliveries.map(d=>[d.customerCode,d.status]));
 const groupKeys=[...new Set(rows.flatMap(r=>r.orders.map(o=>o.groupKey)))];
 const groups=groupKeys.length?await db.orderGroup.findMany({where:{id:{in:groupKeys}},select:{id:true,botId:true,name:true}}):[];
 const bots=groups.length?await db.orderBot.findMany({where:{botId:{in:[...new Set(groups.map(g=>g.botId))]}},select:{botId:true,name:true}}):[];
 return <><h1>รหัสลูกค้า</h1><p>ออกรหัสอัตโนมัติจากออเดอร์พนักงาน หรือเมื่อลูกค้าเข้าสู่ระบบ LINE ชื่อและเบอร์เดิมในออเดอร์ใช้รหัสเดิมและเก็บผู้แนะนำครั้งแรกไว้ หากมีรหัสจาก LINE แล้วให้ระบุในออเดอร์ครั้งแรกเพื่อเชื่อมข้อมูล</p>
 <AutoFilterForm action="/admin/customers"><label>ค้นหารหัส ชื่อ เบอร์ หรือผู้แนะนำ<input name="q" defaultValue={q}/></label></AutoFilterForm><p>พบ {count.toLocaleString('th-TH')} รายการ</p>
 <section className="card"><div className="table-wrap"><table><thead><tr><th>รหัสลูกค้า</th><th>ชื่อผู้รับ</th><th>เบอร์โทร</th><th>ผู้แนะนำเดิม</th><th>ทีม/ร้านจากออเดอร์</th><th>แท็กในระบบ</th><th>ออเดอร์</th><th>แหล่งข้อมูล</th></tr></thead><tbody>{rows.map(r=><tr key={r.code}><th scope="row"><div>{r.code}</div>{deliveryByCode.has(r.code)&&<span className={'pill '+(deliveryByCode.get(r.code)==='FAILED'?'warn':'')} style={{marginTop:5}}>{deliveryByCode.get(r.code)==='SENT'?'ส่งรหัสใน LINE แล้ว':deliveryByCode.get(r.code)==='FAILED'?'ส่งรหัสไม่สำเร็จ':'กำลังส่งรหัส'}</span>}</th><td>{r.name??'ยังไม่ผูกชื่อผู้รับ'}</td><td>{r.phone??'ยังไม่ผูกเบอร์'}</td><td>{r.legacy?'ลูกค้าเก่า':r.referrer?r.referrer.name+' · '+r.referrer.code:'ยังไม่ระบุ'}</td><td style={{whiteSpace:'normal'}}>{r.orders.length?customerOrderTeams(r.orders,groups,bots).map((team,i)=><div key={i}>{team}</div>):'ยังไม่มีออเดอร์ระบุทีม'}</td><td style={{whiteSpace:'normal',minWidth:190}}>{customerTags(r,customerOrderTeams(r.orders,groups,bots)).map(tag=><span className="pill" key={tag} style={{margin:3}}>{tag}</span>)}</td><td>{r._count.orders}</td><td>{r.conversionId||r.lineUserKey?'LINE':'ออเดอร์พนักงาน'}</td></tr>)}</tbody></table></div>{!rows.length&&<p>ไม่พบลูกค้าในรายการนี้</p>}</section>
 <div className="filters">{page>1&&<a href={'?'+new URLSearchParams({q,page:String(page-1)})}>หน้าก่อน</a>}{page*100<count&&<a href={'?'+new URLSearchParams({q,page:String(page+1)})}>หน้าถัดไป</a>}</div>
 <p className="muted">แท็กในระบบสร้างจากข้อมูลลูกค้า ผู้แนะนำ และทีม ไม่ใช่แท็กในหน้าจอแชท LINE OA<br/>ทีม/ร้านแสดงจากออเดอร์ที่ผูกกับรหัสลูกค้า หากซื้อหลายทีมจะแสดงทุกทีม โดยไม่เปลี่ยนผู้แนะนำเดิม<br/>ชื่อหรือเบอร์ต่างกันจะไม่ถูกรวมเอง การเพิ่มรหัสย้อนหลังไม่คำนวณค่าคอมเก่าซ้ำ ค่าคอมซื้อครั้งใหม่ใช้อัตราผู้แนะนำที่บันทึกตอนรับออเดอร์</p></>;
}
