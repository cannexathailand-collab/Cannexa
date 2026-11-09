import {crmMoney} from '@/lib/customer-crm';
import {profitColors} from '@/lib/profit-colors';
import type {CrmDashboardData} from '@/lib/crm-dashboard';
const colors=['#a9c9dc','#cfb594','#bcc9d3','#e0c36c','#a99acb','#d3d9d7'];
export function CrmDashboard({data}:{data:CrmDashboardData}){
 let offset=0;
 return <section className="crm-dashboard" aria-label="แดชบอร์ดลูกค้า">
  <div className="stats">
   <article className="card stat"><span>ลูกค้าทั้งหมด</span><strong>{data.customers.toLocaleString('th-TH')} คน</strong><small>ซื้อซ้ำ {data.repeatCustomers} คน</small></article>
   <article className="card stat"><span>ยอดซื้อสำเร็จสะสม</span><strong>{crmMoney(data.revenueSatang)}</strong><small>{data.purchases} ออเดอร์</small></article>
   <article className="card stat" style={profitColors(data.profitSatang)}><span>กำไรหลังต้นทุนสินค้าและค่าส่ง</span><strong>{crmMoney(data.profitSatang)}</strong><small>{data.missingCosts?'ยังรอต้นทุน '+data.missingCosts+' ออเดอร์':'จากยอดซื้อสำเร็จ'}</small></article>
   <article className="card stat"><span>ไม่รับสินค้า</span><strong>{data.returned} ออเดอร์</strong><small>{data.returnPercent===null?'ยังไม่มีออเดอร์จัดส่ง':data.returnPercent.toFixed(1)+'% ของ '+data.shipped+' ออเดอร์ที่จัดส่ง'}</small></article>
  </div>
  <div className="crm-chart-grid">
   <CrmMonthlyChart data={data}/>
   <article className="card"><h2>สัดส่วนลูกค้าตาม Member</h2><div className="crm-membership-chart"><svg viewBox="0 0 200 200" role="img" aria-label="สัดส่วนลูกค้าตาม Member"><circle cx="100" cy="100" r="68" fill="none" stroke="#edf1ef" strokeWidth="27"/>{data.groups.map((g,i)=>{const start=offset;offset+=g.percent;return <circle key={g.name} cx="100" cy="100" r="68" fill="none" stroke={colors[i%colors.length]} strokeWidth="27" pathLength="100" strokeDasharray={g.percent+' '+(100-g.percent)} strokeDashoffset={-start} transform="rotate(-90 100 100)"><title>{g.name+' '+g.count+' คน ('+g.percent.toFixed(1)+'%)'}</title></circle>;})}<text x="100" y="96" textAnchor="middle" fontSize="23" fontWeight="700" fill="#233d4d">{data.customers}</text><text x="100" y="117" textAnchor="middle" fontSize="12" fill="#738493">ลูกค้า</text></svg><div className="crm-membership-legend">{data.groups.map((g,i)=><div key={g.name}><i style={{background:colors[i%colors.length]}}/><span>{g.name}</span><strong>{g.count} คน <small>{g.percent.toFixed(1)}%</small></strong></div>)}{!data.groups.length&&<p>ไม่พบลูกค้าตามตัวกรองนี้</p>}</div></div></article>
  </div>
  <p className="muted small">สรุปจากลูกค้าที่ตรงกับการค้นหาและตัวกรองทั้งหมด ไม่ใช่เฉพาะหน้าที่กำลังแสดง · ยอดสรุปเป็นยอดสะสมตลอดอายุลูกค้า</p>
 </section>;
}

export function CrmMonthlyChart({data}:{data:Pick<CrmDashboardData,'monthly'|'missingCosts'>}){
 const hi=Math.max(0,...data.monthly.flatMap(m=>[m.revenueSatang,m.profitSatang])),lo=Math.min(0,...data.monthly.map(m=>m.profitSatang)),span=hi-lo||1;
 const y=(v:number)=>20+(hi-v)/span*130,zero=y(0),step=660/data.monthly.length;
 return <article className="card"><h2>แนวโน้มรายเดือน</h2><p className="muted small">12 เดือนล่าสุด · ตามเดือนที่สั่งซื้อ</p><div className="crm-chart-legend"><span><i style={{background:'#75b6d1'}}/>ยอดซื้อสำเร็จ</span><span><i style={{background:'#b7e2c5'}}/>กำไร</span><span><i style={{background:'#f2bdc2'}}/>ขาดทุน</span></div>
    <svg className="crm-month-chart" viewBox="0 0 720 190" role="img" aria-label="แนวโน้มยอดซื้อและกำไรรายเดือน 12 เดือน">
     {[hi,...(hi&&lo?[0]:[]),...(lo!==hi?[lo]:[])].map((v,i)=><g key={i}><line x1="50" x2="710" y1={y(v)} y2={y(v)} stroke={v===0?'#a8bac5':'#e7eeea'}/><text x="44" y={y(v)+4} textAnchor="end" fontSize="10" fill="#738493">{(v/100).toLocaleString('th-TH',{notation:'compact',maximumFractionDigits:1})}</text></g>)}
     {data.monthly.map((m,i)=><g className="crm-month-tick" key={m.month} tabIndex={0}><title>{m.month+' · ยอดซื้อ '+crmMoney(m.revenueSatang)+' · กำไร '+crmMoney(m.profitSatang)+' · '+m.buyers+' คน'+(m.missingCosts?' · รอต้นทุน '+m.missingCosts+' ออเดอร์':'')}</title>{[m.revenueSatang,m.profitSatang].map((v,j)=><rect key={j} x={50+i*step+step*(.15+j*.34)} y={Math.min(y(v),zero)} width={step*.29} height={Math.abs(y(v)-zero)} rx="2" fill={j===0?'#75b6d1':v<0?'#f2bdc2':'#b7e2c5'}/>)}{m.missingCosts>0&&<circle cx={50+i*step+step*.65} cy={156} r="3" fill="#dba45d"/>}<text x={50+i*step+step*.5} y="177" textAnchor="middle" fontSize="10" fill="#738493">{m.month.slice(5)+'/'+m.month.slice(2,4)}</text></g>)}
    </svg>{data.monthly.every(m=>m.purchases===0)&&<p className="muted small">ยังไม่มียอดซื้อสำเร็จในช่วง 12 เดือนนี้</p>}{data.missingCosts>0&&<p className="muted small">จุดสีส้ม: เดือนที่ยังมีต้นทุนไม่ครบ กำไรแสดงเฉพาะส่วนที่คำนวณได้</p>}
   </article>;
}
