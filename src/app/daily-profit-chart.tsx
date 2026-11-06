import type {AccountingRow} from '@/lib/accounting-summary';
const money=(n:number)=>(n/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
export function DailyProfitChart({days,pending=false,view='day'}:{days:Pick<AccountingRow,'day'|'profitSatang'>[];pending?:boolean;view?:string}){
 const period=view==='year'?'รายปี':view==='month'?'รายเดือน':'รายวัน';
 const width=Math.max(680,days.length*32+100),height=300,left=90,top=24,bottom=245;
 const low=Math.min(0,...days.map(d=>d.profitSatang)),high=Math.max(0,...days.map(d=>d.profitSatang));
 const span=high-low||100,y=(n:number)=>top+(high-n)/span*(bottom-top),zero=y(0),step=(width-left-20)/Math.max(days.length,1);
 return <section className="card"><h2>กำไรสุทธิ{period}</h2><p className="muted">รายรับ − รายจ่ายรวมต้นทุน · สีเขียวคือกำไร สีแดงคือขาดทุน · แสดง{period}ตามช่วงวันที่เลือก</p>
 {pending&&<p className="small muted">เป็นยอดเบื้องต้นตามรายการที่บันทึก ยังมีรายการค้างตามหมายเหตุด้านบน</p>}
 <div style={{overflowX:'auto'}}><svg role="img" aria-label={'แผนภูมิกำไรขาดทุน'+period} viewBox={`0 0 ${width} ${height}`} style={{width:'100%',minWidth:width,height:300}}>
 <title>{'กำไรสุทธิ'+period+'ตามช่วงวันที่เลือก'}</title>
 {[high,...(high&&low?[0]:[]),...(low!==high?[low]:[])].map((n,i)=><g key={i}><line x1={left} x2={width-10} y1={y(n)} y2={y(n)} stroke={n===0?'#62746c':'#e5ebe8'} strokeDasharray={n===0?undefined:'4 4'}/><text x={left-8} y={y(n)+4} textAnchor="end" fontSize="11" fill="#52645b">{(n/100).toLocaleString('th-TH',{maximumFractionDigits:2})}</text></g>)}
 <text x="12" y="14" fontSize="11" fill="#52645b">บาท</text>
 {days.map((d,i)=>{const x=left+i*step+step*.15,v=y(d.profitSatang);return <g key={d.day}>
 <title>{d.day+' · สุทธิ '+money(d.profitSatang)}</title>
 <rect x={x} y={Math.min(zero,v)} width={step*.7} height={Math.abs(v-zero)||2} fill={d.profitSatang<0?'#c2414b':d.profitSatang>0?'#16836b':'#94a39c'}/>
 <text x={x+step*.35} y={bottom+22} textAnchor="middle" fontSize="10" fill="#52645b" transform={`rotate(-40 ${x+step*.35} ${bottom+22})`}>{view==='day'?d.day.slice(5):d.day}</text>
 </g>;})}</svg></div><p className="small muted">ยอดสุทธิรวมช่วงนี้ {money(days.reduce((n,d)=>n+d.profitSatang,0))} · ดูยอดรายวันและส่งออก CSV ได้จากตารางด้านล่าง</p></section>;
}
