import type {ExpenseEntry} from '@/lib/expense-report';
import {expenseBreakdown} from '@/lib/expense-breakdown';
const money=(n:number)=>(n/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
export function ExpenseBreakdownChart({entries,from,to}:{entries:Pick<ExpenseEntry,'kind'|'amountSatang'>[];from:string;to:string}){
 const data=expenseBreakdown(entries);
 return <section className="card"><h2>ภาพรวมสัดส่วนค่าใช้จ่าย</h2><p className="muted">{from} ถึง {to} · เปอร์เซ็นต์จากรายจ่ายก่อนหักรายการคืนและลดค่าใช้จ่าย</p>
 <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:28}}>
  <svg role="img" aria-label="กราฟวงแหวนสัดส่วนค่าใช้จ่าย" viewBox="0 0 240 240" style={{width:240,maxWidth:'100%',flexShrink:0}}>
   <title>สัดส่วนค่าใช้จ่ายตามหมวดในช่วงวันที่เลือก</title>
   <circle cx="120" cy="120" r="84" fill="none" stroke="#edf1ef" strokeWidth="28"/>
   {data.slices.map(s=><circle key={s.key} cx="120" cy="120" r="84" fill="none" stroke={s.color} strokeWidth="28" pathLength="100" strokeDasharray={`${s.percent} ${100-s.percent}`} strokeDashoffset={-s.offset} transform="rotate(-90 120 120)"><title>{s.label} {s.percent.toFixed(1)}%</title></circle>)}
   <text x="120" y="112" textAnchor="middle" fill="#6b7e77" fontSize="13">รายจ่ายรวม</text>
   <text x="120" y="137" textAnchor="middle" fill="#142b28" fontSize="17" fontWeight="bold">{money(data.grossSatang)}</text>
  </svg>
  <div style={{flex:'1 1 280px'}}>{!data.slices.length?<p>ยังไม่มีรายจ่ายในช่วงที่เลือก</p>:<table><thead><tr><th>หมวด</th><th>จำนวนเงิน</th><th>สัดส่วน</th></tr></thead><tbody>{data.slices.map(s=><tr key={s.key}><td><span aria-hidden="true" style={{display:'inline-block',width:10,height:10,borderRadius:3,background:s.color,marginRight:8}}/>{s.label}</td><td>{money(s.amountSatang)}</td><td>{s.percent.toFixed(1)}%</td></tr>)}</tbody></table>}
  <p className="small muted">คืน/ลดค่าใช้จ่าย {money(data.creditsSatang)} · ค่าใช้จ่ายสุทธิ {money(data.netSatang)}</p></div>
 </div></section>;
}
