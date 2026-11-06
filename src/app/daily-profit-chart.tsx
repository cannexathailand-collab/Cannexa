import {profitColors} from '@/lib/profit-colors';
import type {AccountingRow} from '@/lib/accounting-summary';
const money=(n:number)=>(n/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
export function DailyProfitChart({days,pending=false,view='day'}:{days:Pick<AccountingRow,'day'|'profitSatang'>[];pending?:boolean;view?:string}){
 const period=view==='year'?'รายปี':view==='month'?'รายเดือน':'รายวัน';
 const scale=Math.max(1,...days.map(d=>Math.abs(d.profitSatang)));
 const columns='minmax(80px, 100px) minmax(70px, 1fr) minmax(95px, 130px)';
 return <section className="card"><h2>กำไรสุทธิ{period}</h2><p className="muted">อ่านจากบนลงล่างตามลำดับเวลา · สีเขียวคือกำไร สีแดงคือขาดทุน · ยอดเงินอยู่ท้ายแต่ละแถว</p>
 {pending&&<p className="small muted">เป็นยอดเบื้องต้นตามรายการที่บันทึก ยังมีรายการค้างตามหมายเหตุด้านบน</p>}
 <div style={{display:'grid',gridTemplateColumns:columns,gap:10,padding:'8px 0',fontWeight:600}}><span>{view==='year'?'ปี':view==='month'?'เดือน':'วันที่'}</span><span style={{textAlign:'center'}}>ขาดทุน ← 0 → กำไร</span><span style={{textAlign:'right'}}>สุทธิ (บาท)</span></div>
 <div role="figure" aria-label={'แผนภูมิกำไรขาดทุน'+period}>
 {days.map(d=>{const value=d.profitSatang,width=Math.abs(value)/scale*50,colors=profitColors(value);return <div key={d.day} style={{display:'grid',gridTemplateColumns:columns,alignItems:'center',gap:10,padding:'12px 0',borderTop:'1px solid #edf1ef'}}>
 <span>{d.day}</span><div aria-hidden="true" style={{position:'relative',height:26,background:'#f4f7f5',borderRadius:4}}><span style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,background:'#84968d'}}/><span style={{position:'absolute',top:4,height:18,borderRadius:3,background:colors.backgroundColor,boxShadow:'inset 0 0 0 1px '+colors.color,left:(value<0?50-width:50)+'%',width:width+'%',minWidth:value===0?2:undefined}}/></div>
 <strong style={{textAlign:'right',...colors,padding:'5px 7px',borderRadius:6,fontVariantNumeric:'tabular-nums'}}>{money(value)}</strong>
 </div>;})}
 </div><p className="small muted">สุทธิ = รายรับ − รายจ่ายรวมต้นทุน · ยอดสุทธิรวมช่วงนี้ {money(days.reduce((n,d)=>n+d.profitSatang,0))}</p></section>;
}
