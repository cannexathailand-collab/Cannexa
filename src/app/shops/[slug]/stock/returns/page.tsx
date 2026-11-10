import {withShopWorkspace} from '@/lib/shop-workspace';
import {shopPath} from '@/lib/shop-session';
import {ShopWorkspaceNav} from '../../workspace-nav';
export default async function Returns({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{status?:string}>}){
 const {slug}=await params,{status}=await searchParams;
 const {shop,account,rows}=await withShopWorkspace(slug,async({shop,account,client})=>({shop,account,rows:await client.stockReturn.findMany({orderBy:{updatedAt:'desc'},take:100})}),['owner','store']);
 return <main className="main"><h1>รับสินค้าตีกลับ · {shop.name}</h1><ShopWorkspaceNav slug={slug} role={account.role}/>{status&&<p role="status">{status==='saved'?'บันทึกการรับคืนแล้ว':'บันทึกไม่สำเร็จ กรุณาตรวจสอบรายการ'}</p>}<p>ยืนยันรับคืนเมื่อได้รับสินค้าและตรวจครบแล้ว ระบบจึงคืนจำนวนเข้าสต๊อก</p>{rows.map(row=><section key={row.id} className="card"><h2>{row.tracking}</h2><p>{row.stage} · {row.status}</p>{Array.isArray(row.issues)&&row.issues.map((issue,index)=><p key={index}>{typeof issue==='string'?issue:''}</p>)}{!['POSTED','NO_STOCK_CHANGE'].includes(row.status)&&<form action={shopPath(slug)+'/stock/returns/confirm'} method="post"><input type="hidden" name="tracking" value={row.tracking}/>{row.stage==='RECEIVED'?<input type="hidden" name="confirm" value="yes"/>:<label><input name="confirm" type="checkbox" value="yes" required/> รับสินค้าคืนและตรวจครบแล้ว</label>}<button>{row.stage==='RECEIVED'?'ประมวลผลคืนสินค้าอีกครั้ง':'ยืนยันรับคืน'}</button></form>}</section>)}{!rows.length&&<p>ไม่มีรายการสินค้าตีกลับ</p>}</main>;
}
