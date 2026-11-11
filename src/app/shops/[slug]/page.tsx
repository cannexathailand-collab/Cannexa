import {visibleOrderWhere} from '@/lib/order-list-visibility';
import {ShopWorkspaceNav} from './workspace-nav';
import {requireShopAccount,shopPath} from '@/lib/shop-session';

export default async function ShopHome({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params,{shop,account,client}=await requireShopAccount(slug);
 // The first tenant portal is owner-only until role-specific workflows are connected.
 if(account.role!=='owner')return <main className="main"><h1>{shop.name}</h1><ShopWorkspaceNav slug={slug} role={account.role}/><form action={shopPath(slug)+'/logout'} method="post"><button>ออกจากระบบ</button></form></main>;
 const [customers,orders,users,latestCustomers,latestOrders]=await Promise.all([
  client.customer.count(),client.orderIntake.count({where:visibleOrderWhere}),client.userAccount.count(),
  client.customer.findMany({take:25,orderBy:[{createdAt:'desc'},{code:'asc'}],select:{code:true,name:true,phone:true}}),
  client.orderIntake.findMany({where:visibleOrderWhere,take:25,orderBy:[{createdAt:'desc'},{id:'asc'}],select:{id:true,orderNumber:true,recipient:true,status:true}}),
 ]);
 return <main className="main"><div className="intro"><div><h1>{shop.name}</h1><p>เข้าสู่ระบบในชื่อ {account.username}</p></div><form action={shopPath(slug)+'/logout'} method="post"><button className="secondary">ออกจากระบบ</button></form></div><ShopWorkspaceNav slug={slug}/><section className="card"><h2>ภาพรวมร้าน</h2><p>ลูกค้า {customers} คน · ออเดอร์ {orders} รายการ · ผู้ใช้ {users} บัญชี</p></section><section className="card"><h2>ลูกค้าล่าสุด 25 ราย</h2>{latestCustomers.length?<div className="table-wrap"><table><thead><tr><th>รหัสลูกค้า</th><th>ชื่อ</th><th>โทรศัพท์</th></tr></thead><tbody>{latestCustomers.map(customer=><tr key={customer.code}><td>{customer.code}</td><td>{customer.name||'—'}</td><td>{customer.phone||'—'}</td></tr>)}</tbody></table></div>:<p>ยังไม่มีลูกค้าในร้านนี้</p>}</section><section className="card"><h2>ออเดอร์ล่าสุด 25 รายการ</h2>{latestOrders.length?<div className="table-wrap"><table><thead><tr><th>เลขออเดอร์</th><th>ผู้รับ</th><th>สถานะ</th></tr></thead><tbody>{latestOrders.map(order=><tr key={order.id}><td>{order.orderNumber}</td><td>{order.recipient||'—'}</td><td>{order.status}</td></tr>)}</tbody></table></div>:<p>ยังไม่มีออเดอร์ในร้านนี้</p>}</section></main>;
}
