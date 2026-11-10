import {isEmployeeRole} from '@/lib/accounts';
import {withShopWorkspace} from '@/lib/shop-workspace';
import {bookedSalesReport} from '@/lib/booked-sales';
import {ShopWorkspaceNav} from '../workspace-nav';
const money=(amount:number)=> (amount/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
export default async function Sales({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{from?:string;to?:string}>}){
 const {slug}=await params,filters=await searchParams;
 const {shop,account,report}=await withShopWorkspace(slug,async({shop,account})=>({shop,account,report:await bookedSalesReport({...filters,...(isEmployeeRole(account.role)?{seller:account.username}:{})})}),['owner','admin','manager','viewer','employee','sales']);
 const total=report.summary;
 return <main className="main"><h1>ยอดขาย · {shop.name}</h1><ShopWorkspaceNav slug={slug} role={account.role}/><section className="card"><form method="get" className="form-grid"><label>ตั้งแต่วันที่<input name="from" type="date" defaultValue={report.range.from}/></label><label>ถึงวันที่<input name="to" type="date" defaultValue={report.range.to}/></label><div><button>แสดงยอดขาย</button></div></form></section><section className="card"><h2>สรุปรอบออเดอร์</h2><p>ยอดขาย {money(total.revenueSatang)} บาท · {total.count} ออเดอร์</p><p>ยอดโอน {money(total.transferSatang)} บาท · ยอด COD {money(total.codSatang)} บาท</p><p>ต้นทุนสินค้า {money(total.costSatang)} บาท</p><p>กำไรขั้นต้น {total.profitSatang===null?'ข้อมูลต้นทุนหรือยอดขายยังไม่ครบ':money(total.profitSatang)+' บาท'}</p>{total.estimatedCostCount>0&&<p className="muted">มีต้นทุนประมาณการ {total.estimatedCostCount} ออเดอร์</p>}</section></main>;
}
