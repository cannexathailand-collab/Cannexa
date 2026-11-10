import {withShopWorkspace} from '@/lib/shop-workspace';
import {accountingReport} from '@/lib/accounting-report';
import {ShopWorkspaceNav} from '../workspace-nav';
const money=(amount:number)=>(amount/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
export default async function Accounting({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{from?:string;to?:string}>}){
 const {slug}=await params,filters=await searchParams;
 const {shop,account,report}=await withShopWorkspace(slug,async({shop,account})=>({shop,account,report:await accountingReport(filters)}),['owner','admin']);
 return <main className="main"><h1>บัญชี · {shop.name}</h1><ShopWorkspaceNav slug={slug} role={account.role}/><section className="card"><form method="get" className="form-grid"><label>ตั้งแต่วันที่<input name="from" type="date" defaultValue={report.range.from}/></label><label>ถึงวันที่<input name="to" type="date" defaultValue={report.range.to}/></label><div><button>แสดงบัญชี</button></div></form><p>รายรับ {money(report.total.revenueSatang)} บาท</p><p>รายจ่าย {money(report.total.expenseSatang)} บาท</p><p>ส่วนต่างรายรับและรายจ่าย {money(report.total.profitSatang)} บาท</p>{report.notices.map(notice=><p className="notice" key={notice}>{notice}</p>)}</section><section className="card"><h2>รายการบัญชี</h2><div className="table-wrap"><table><thead><tr><th>วันที่</th><th>รายการ</th><th>รายรับ</th><th>รายจ่าย</th></tr></thead><tbody>{report.journal.map(row=><tr key={row.id}><td>{row.date.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'})}</td><td>{row.description}</td><td>{money(row.incomeSatang)}</td><td>{money(row.expenseSatang)}</td></tr>)}</tbody></table></div></section></main>;
}
