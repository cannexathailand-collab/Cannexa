import {OrderDocumentButtons} from '@/app/order-document-buttons';
import {loadOrderTeamNames} from '@/lib/order-team';
import {ShopOrderActions} from './order-actions';
import {randomUUID} from 'node:crypto';
import {withShopWorkspace} from '@/lib/shop-workspace';
import {shopPath} from '@/lib/shop-session';
import {isEmployeeRole} from '@/lib/accounts';
import {ShopWorkspaceNav} from '../workspace-nav';
export default async function Orders({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{status?:string;message?:string}>}){
 const {slug}=await params,{status,message}=await searchParams;
 const {shop,account,orders,teams}=await withShopWorkspace(slug,async({shop,account,client})=>{const orders=await client.orderIntake.findMany({where:isEmployeeRole(account.role)?{sellerUsername:account.username}:{},orderBy:{createdAt:'desc'},take:100});return {shop,account,orders,teams:await loadOrderTeamNames(orders.map(order=>order.groupKey))}},['owner','admin','manager','employee','sales','store','viewer']);
 return <main className="main"><h1>ออเดอร์ · {shop.name}</h1><ShopWorkspaceNav slug={slug} role={account.role}/>{status&&<p role="status" className="notice">{status==='saved'?'บันทึกออเดอร์แล้ว':status==='changed'?'บันทึกการเปลี่ยนแปลงแล้ว':message||'บันทึกไม่ได้ กรุณาตรวจข้อความ ผู้ขาย และสต๊อกสินค้า'}</p>}{!['store','viewer'].includes(account.role)&&<section className="card"><h2>บันทึกออเดอร์</h2><p>ใช้ข้อความส่งงานที่มีรหัสผู้ขาย ชื่อผู้รับ โทรศัพท์ ที่อยู่ สินค้า วิธีชำระเงิน และยอดรวม</p><form action={shopPath(slug)+'/orders/save'} method="post"><input type="hidden" name="requestKey" value={randomUUID()}/><label>ข้อความออเดอร์<textarea name="text" required maxLength={10000} rows={12}/></label><button>บันทึกออเดอร์</button></form></section>}<section className="card"><h2>ออเดอร์ล่าสุด</h2>{orders.map(order=><article className="card" key={order.id}><h3>{order.orderNumber}</h3><p>{order.recipient??'—'} · {order.payment??'—'} · {order.status}</p><p>ผู้ขาย {order.sellerUsername??order.sellerCode??'—'}</p><p>ทีมจัดส่ง {teams.get(order.groupKey)??'ยังไม่ระบุทีม'}</p><details><summary>ดูรายละเอียด</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{order.rawText}</pre></details><div className="shipping-actions shop-order-action-bar"><ShopOrderActions slug={slug} role={account.role} order={order}/>{account.role!=='viewer'&&<OrderDocumentButtons orderId={order.id} shopBase={shopPath(slug)}/>}</div></article>)}</section></main>;
}
