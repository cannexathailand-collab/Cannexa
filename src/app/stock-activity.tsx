import Link from 'next/link';
import {stockActivityReport} from '@/lib/stock-activity';
export async function StockActivity({day,page,query,filter}:{day?:string;page?:string;query:string;filter:string}){
 const report=await stockActivityReport({day,page});
 const pageLink=(page:number)=>'/admin/stock?'+new URLSearchParams({q:query,filter,activityDay:report.day,activityPage:String(page)})+'#stock-activity';
 return <section className="card" id="stock-activity">
  <div className="intro"><h2>ประวัติการแก้ไขสต๊อก</h2><span className="pill">{report.total} เหตุการณ์</span></div>
  <form action="/admin/stock#stock-activity" method="get" className="form-grid">
   <input type="hidden" name="q" value={query}/><input type="hidden" name="filter" value={filter}/>
   <label>วันที่ดูประวัติ<input type="date" name="activityDay" defaultValue={report.day}/></label><div className="actions"><button className="secondary">ดูประวัติ</button></div>
  </form>
  <p className="muted small">แสดงผู้ใช้ เวลา และรายละเอียดการแก้ไขผ่านระบบ ไม่รวมการแก้ไขโดยตรงใน Google Sheets</p>
  {report.events.length?<div className="table-wrap"><table><thead><tr><th>วันเวลา</th><th>ผู้ดำเนินการ</th><th>รายการ</th><th>รายละเอียด</th></tr></thead><tbody>{report.events.map(event=><tr key={event.id}>
   <td>{event.at.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</td><td>{event.actor}</td><td>{event.title}</td>
   <td style={{whiteSpace:'normal',minWidth:270}}>{event.summary.map((line,i)=><div key={i}>{line}</div>)}{event.items.map((item,i)=><div key={'item'+i}>{item.label} · {(item.amountSatang/100).toLocaleString('th-TH',{minimumFractionDigits:2})} บาท</div>)}</td>
  </tr>)}</tbody></table></div>:<p className="muted">ยังไม่มีการแก้ไขสต๊อกในวันที่เลือก</p>}
  {report.pages>1&&<div className="actions" style={{marginTop:16}}>{report.page>1&&<Link className="button secondary" href={pageLink(report.page-1)}>ก่อนหน้า</Link>}<span>หน้า {report.page} / {report.pages}</span>{report.page<report.pages&&<Link className="button secondary" href={pageLink(report.page+1)}>ถัดไป</Link>}</div>}
 </section>;
}
