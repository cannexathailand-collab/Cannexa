import {visibleOrderWhere} from '@/lib/order-list-visibility';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {PrismaClient} from '@prisma/client';
import {db,withDatabase} from '@/lib/db';
import {requirePlatformAdministrator,shopDatabase} from '@/lib/platform-shops';
import {bookedSalesReport} from '@/lib/booked-sales';
import {accountingReport} from '@/lib/accounting-report';
import {readStockSheet} from '@/lib/stock-google';
import {customerAddress} from '@/lib/customer-address';
import {loadCustomerCrm} from '@/lib/customer-crm';
import {platformCustomerData} from '@/lib/platform-customer-data';

type Filters={view?:string;q?:string;page?:string;order?:string;customer?:string;from?:string;to?:string};
const views=[['overview','ภาพรวมและยอดขาย'],['customers','ลูกค้า'],['orders','ออเดอร์'],['stock','สต๊อก'],['accounting','บัญชี'],['users','ผู้ใช้']] as const;
const money=(amount:number)=>(amount/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});

async function Overview({client,filters}:{client:PrismaClient;filters:Filters}){
 const [report,customers,orders]=await Promise.all([withDatabase(client,()=>bookedSalesReport({from:filters.from,to:filters.to})),client.customer.count(),client.orderIntake.count({where:visibleOrderWhere})]);
 return <section className="card"><h2>ภาพรวม</h2><p>ลูกค้า {customers} คน · ออเดอร์ {orders} รายการ</p><p>ยอดขายในช่วงที่เลือก {money(report.summary.revenueSatang)} บาท</p><p>ยอดโอน {money(report.summary.transferSatang)} บาท · ยอด COD {money(report.summary.codSatang)} บาท</p><p>กำไรขั้นต้น {report.summary.profitSatang===null?'ข้อมูลยังไม่ครบ':money(report.summary.profitSatang)+' บาท'}</p><p className="muted">ต้นทุนประมาณการ {report.summary.estimatedCostCount} ออเดอร์</p></section>;
}
async function Customers({client,q,page,path,selected}:{client:PrismaClient;q:string;page:number;path:string;selected?:string}){
 if(selected){
  const customer=await client.customer.findUnique({where:{code:selected}});
  if(!customer)return <section className="card"><p>ไม่พบลูกค้าในร้านนี้</p></section>;
  const data=(await loadCustomerCrm([customer.code],undefined,client)).get(customer.code)!;
  const financial=(await platformCustomerData(client,new Date(),customer.code))[0];
  const resolvedAddress=customerAddress(customer.address,data.allHistory.map(row=>row.order));
  return <section className="card">
   <h2>{customer.name||customer.code}</h2><p>{customer.code} · {customer.phone||'ไม่มีเบอร์โทร'}</p>
   <p>{resolvedAddress.address||'ไม่มีที่อยู่'}{resolvedAddress.source&&<small className="muted"> · จาก{resolvedAddress.source}</small>}</p>
   <p>ยอดขายรวม {money(financial.orderedSatang)} บาท · ยอดรอรับเงิน COD {money(financial.pendingSatang)} บาท</p>
   <p>ออเดอร์ {data.orderCount} ครั้ง · รับเงินสำเร็จ {money(financial.purchasedSatang)} บาท</p>
   <p>กำไรหลังต้นทุนสินค้าของออเดอร์รับเงินแล้ว {financial.profitSatang===null?'รอต้นทุนสินค้า':money(financial.profitSatang)+' บาท'}</p>
   <p>กำไรประมาณการ COD ที่รอรับเงิน {financial.pendingCod.profitSatang===null?'รอข้อมูลครบ':money(financial.pendingCod.profitSatang)+' บาท'}</p>
   {financial.receivedEstimatedCostCount>0&&<p className="muted">ต้นทุนออเดอร์รับเงินแล้วบางส่วนเป็นประมาณการก่อนจัดส่ง</p>}
   <h3>ประวัติออเดอร์</h3>{data.allHistory.map(row=><p key={row.order.id}><Link href={path+'?'+new URLSearchParams({view:'orders',order:row.order.id})}>{row.order.orderNumber}</Link> · {row.order.eventAt.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'})} · {row.amountSatang===null?'ยังไม่ทราบยอด':money(row.amountSatang)+' บาท'} · {row.order.payment==='โอน'&&!row.excluded?'โอนแล้ว · ':''}{row.status}</p>)}
   {!data.allHistory.length&&<p>ยังไม่มีประวัติออเดอร์</p>}
  </section>;
 }
 const where=q?{OR:[{code:{contains:q,mode:'insensitive' as const}},{name:{contains:q,mode:'insensitive' as const}},{phone:{contains:q}}]}:{};
 const rows=await client.customer.findMany({where,skip:(page-1)*50,take:50,orderBy:[{createdAt:'desc'},{code:'asc'}],select:{code:true,name:true,phone:true,address:true}});
 const histories=await loadCustomerCrm(rows.map(row=>row.code),undefined,client);
 return <section className="card"><h2>ข้อมูลลูกค้า</h2><div className="table-wrap"><table><thead><tr><th>รหัส</th><th>ชื่อ</th><th>โทรศัพท์</th><th>ที่อยู่</th></tr></thead><tbody>{rows.map(row=><tr key={row.code}><td>{row.code}</td><td>{row.name??'—'}</td><td>{row.phone??'—'}</td><td>{customerAddress(row.address,histories.get(row.code)!.allHistory.map(entry=>entry.order)).address??'—'}</td></tr>)}</tbody></table></div>{!rows.length&&<p>ไม่มีรายการในหน้านี้</p>}</section>;
}
async function Orders({client,q,page,path,selected}:{client:PrismaClient;q:string;page:number;path:string;selected?:string}){
 const where=q?{OR:[{orderNumber:{contains:q,mode:'insensitive' as const}},{recipient:{contains:q,mode:'insensitive' as const}},{phone:{contains:q}}]}:{};
 const [rows,order]=await Promise.all([client.orderIntake.findMany({where:{AND:[where,visibleOrderWhere]},skip:(page-1)*50,take:50,orderBy:[{createdAt:'desc'},{id:'asc'}],select:{id:true,orderNumber:true,recipient:true,sellerUsername:true,status:true}}),selected?client.orderIntake.findUnique({where:{id:selected}}):null]);
 const shipment=order?await client.shipment.findUnique({where:{orderId:order.id},select:{tracking:true,fulfillmentStatus:true,dispatchedAt:true}}):null;
 return <><section className="card"><h2>ออเดอร์</h2>{rows.map(row=><p key={row.id}><Link href={path+'?'+new URLSearchParams({view:'orders',q,page:String(page),order:row.id})}>{row.orderNumber}</Link> · {row.recipient??'—'} · {row.sellerUsername??'—'} · {row.status}</p>)}{!rows.length&&<p>ไม่มีรายการในหน้านี้</p>}</section>{order&&<section className="card"><h2>{order.orderNumber}</h2><p>{order.recipient} · {order.phone}</p><p>{order.address}</p><p>ผู้ขาย {order.sellerUsername??order.sellerCode??'—'}</p><p>เลขพัสดุ {shipment?.tracking??'—'} · {shipment?.fulfillmentStatus??order.status}</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{order.rawText}</pre></section>}</>;
}
async function Stock({client}:{client:PrismaClient}){
 const live=await withDatabase(client,()=>readStockSheet().catch(()=>null));
 const rows=live?.products??(await client.stockProduct.findMany()).map(row=>({...row,remainingQuantity:row.remainingQuantity?.toNumber()??null}));
 return <section className="card"><h2>สต๊อกสินค้า</h2><div className="table-wrap"><table><thead><tr><th>รหัส</th><th>สินค้า</th><th>คงเหลือกรัม</th><th>ต้นทุน/กรัม</th></tr></thead><tbody>{rows.map(row=><tr key={row.code}><td>{row.code}</td><td>{row.name||'—'}</td><td>{row.remainingQuantity??'—'}</td><td>{row.costSatang===null?'—':money(row.costSatang)}</td></tr>)}</tbody></table></div></section>;
}
async function Accounting({client,filters}:{client:PrismaClient;filters:Filters}){
 const report=await withDatabase(client,()=>accountingReport({from:filters.from,to:filters.to}));
 return <section className="card"><h2>บัญชี</h2><p>รายรับ {money(report.total.revenueSatang)} บาท · รายจ่าย {money(report.total.expenseSatang)} บาท</p>{report.notices.map(notice=><p key={notice}>{notice}</p>)}<div className="table-wrap"><table><thead><tr><th>วันที่</th><th>รายการ</th><th>รายรับ</th><th>รายจ่าย</th></tr></thead><tbody>{report.journal.map(row=><tr key={row.id}><td>{row.date.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'})}</td><td>{row.description}</td><td>{money(row.incomeSatang)}</td><td>{money(row.expenseSatang)}</td></tr>)}</tbody></table></div></section>;
}
async function Users({client}:{client:PrismaClient}){
 const rows=await client.userAccount.findMany({select:{username:true,role:true,active:true},orderBy:{username:'asc'}});
 return <section className="card"><h2>ผู้ใช้</h2>{rows.map(row=><p key={row.username}>{row.username} · {row.role} · {row.active?'เปิดใช้งาน':'ปิดใช้งาน'}</p>)}</section>;
}
export default async function PlatformShop({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Filters>}){
 let actor;try{actor=await requirePlatformAdministrator()}catch(error){if(error instanceof Error&&error.message==='PLATFORM_FORBIDDEN')notFound();throw error;}
 const {id}=await params,filters=await searchParams;
 const shop=await db.platformShop.findUnique({where:{id}});if(!shop)notFound();
 const view=views.some(([key])=>key===filters.view)?filters.view!:'overview';
 const page=Math.min(10000,Math.max(1,Number.parseInt(filters.page??'1',10)||1)),q=(filters.q??'').trim().slice(0,100);
 const client=shopDatabase(shop.schemaName),path='/platform/shops/'+encodeURIComponent(shop.id);
 await db.platformAuditLog.create({data:{actor:actor.username,action:'SHOP_VIEWED',shopId:id,details:{view}}});
 return <main className="main"><div className="intro"><div><h1>{shop.name}</h1><p>ผู้ดูแลแพลตฟอร์ม · ข้อมูลของร้าน {shop.slug}</p></div><Link className="button secondary" href="/platform">กลับรายการร้าน</Link></div><nav className="actions" aria-label="ข้อมูลร้าน">{views.map(([key,label])=><Link key={key} className="button secondary" href={path+'?view='+key} aria-current={view===key?'page':undefined}>{label}</Link>)}</nav><p><a className="button secondary" href={'/api/platform/export?kind=business&shop='+encodeURIComponent(id)}>ส่งออกข้อมูลธุรกิจร้านนี้</a></p>{['overview','accounting'].includes(view)&&<section className="card"><form className="form-grid" method="get"><input type="hidden" name="view" value={view}/><label>ตั้งแต่วันที่<input type="date" name="from" defaultValue={filters.from}/></label><label>ถึงวันที่<input type="date" name="to" defaultValue={filters.to}/></label><div><button>แสดงข้อมูล</button></div></form></section>}{['customers','orders'].includes(view)&&<section className="card"><form method="get"><input type="hidden" name="view" value={view}/><label>ค้นหา<input name="q" defaultValue={q}/></label><button>ค้นหา</button></form><p>หน้า {page} · หน้าละ 50 รายการ</p><div className="actions">{page>1&&<Link href={path+'?'+new URLSearchParams({view,q,page:String(page-1)})}>ก่อนหน้า</Link>}<Link href={path+'?'+new URLSearchParams({view,q,page:String(page+1)})}>ถัดไป</Link></div></section>}{view==='overview'&&<Overview client={client} filters={filters}/>} {view==='customers'&&<Customers client={client} q={q} page={page} path={path} selected={filters.customer}/>} {view==='orders'&&<Orders client={client} q={q} page={page} path={path} selected={filters.order}/>} {view==='stock'&&<Stock client={client}/>} {view==='accounting'&&<Accounting client={client} filters={filters}/>} {view==='users'&&<Users client={client}/>}</main>;
}
