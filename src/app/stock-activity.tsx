import Link from 'next/link';
import {stockActivityReport,stockActivityActions} from '@/lib/stock-activity';
export async function StockActivity({day,from,to,actor,action,page,query,filter}:{day?:string;from?:string;to?:string;actor?:string;action?:string;page?:string;query:string;filter:string}){
 const report=await stockActivityReport({day,from,to,actor,action,page});
 const pageLink=(page:number)=>'/admin/stock?'+new URLSearchParams({q:query,filter,activityFrom:report.from,activityTo:report.to,activityActor:report.actor,activityAction:report.action,activityPage:String(page)})+'#stock-activity';
 return <section className="card" id="stock-activity">
  <div className="intro"><h2>ประวัติการแก้ไขสต๊อก</h2><span className="pill">{report.total} เหตุการณ์</span></div>
  <form action="/admin/stock#stock-activity" method="get" className="form-grid">
   <input type="hidden" name="q" value={query}/><input type="hidden" name="filter" value={filter}/>
   <label>ตั้งแต่วันที่<input type="date" name="activityFrom" defaultValue={report.from} required/></label>
   <label>ถึงวันที่<input type="date" name="activityTo" defaultValue={report.to} required/></label>
   <label>พนักงานสโตร์<select name="activityActor" defaultValue={report.actor}><option value="">ทุกคน</option>{report.staff.map(account=><option value={account.username} key={account.username}>{account.username}</option>)}</select></label>
   <label>ประเภทรายการ<select name="activityAction" defaultValue={report.action}><option value="">ทุกประเภท</option>{Object.entries(stockActivityActions).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
   <div className="actions"><button className="secondary">ดูประวัติ</button><Link href={'/admin/stock?'+new URLSearchParams({q:query,filter})+'#stock-activity'}>ล้างตัวกรองประวัติ</Link></div>
  </form>
  {report.error&&<p role="alert" className="notice">{report.error}</p>}
  <p className="muted small">แสดงเฉพาะการแก้ไขผ่านระบบโดยพนักงานสโตร์ ไม่รวมบัญชีอื่น ระบบอัตโนมัติ และการแก้ไขโดยตรงใน Google Sheets</p>
  {report.events.length?<div className="table-wrap"><table><thead><tr><th>วันเวลา</th><th>ผู้ดำเนินการ</th><th>รายการ</th><th>รายละเอียด</th></tr></thead><tbody>{report.events.map(event=><tr key={event.id}>
   <td>{event.at.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</td><td>{event.actor}</td><td>{event.title}</td>
   <td style={{whiteSpace:'normal',minWidth:270}}>{event.summary.map((line,i)=><div key={i}>{line}</div>)}{event.items.map((item,i)=><div key={'item'+i}>{item.label} · {(item.amountSatang/100).toLocaleString('th-TH',{minimumFractionDigits:2})} บาท</div>)}</td>
  </tr>)}</tbody></table></div>:!report.error&&<p className="muted">ไม่พบการแก้ไขสต๊อกของพนักงานสโตร์ตามช่วงวันที่และตัวกรองที่เลือก</p>}
  {report.pages>1&&<div className="actions" style={{marginTop:16}}>{report.page>1&&<Link className="button secondary" href={pageLink(report.page-1)}>ก่อนหน้า</Link>}<span>หน้า {report.page} / {report.pages}</span>{report.page<report.pages&&<Link className="button secondary" href={pageLink(report.page+1)}>ถัดไป</Link>}</div>}
 </section>;
}
