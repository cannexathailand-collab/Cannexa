'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {dashboardQuery,type DashboardData,type DashboardFilters} from '@/lib/accounting-dashboard';
import {profitColors} from '@/lib/profit-colors';
const money=(n:number)=>(n/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
const palette=['#4197bd','#2a708f','#72b4ca','#a3cfdb','#5c859b','#d6e5eb'];
type Kind='profit'|'expenses'|'income'|'flow';
const titles:Record<Kind,string>={profit:'กำไรสุทธิ',expenses:'ค่าใช้จ่ายตามหมวด',income:'รายรับตามแหล่งที่มา',flow:'รายรับและรายจ่าย'};
function Donut({items,total,label}:{items:{label:string;amountSatang:number;color?:string}[];total:number;label:string}){
 let offset=0;
 return <div className="accounting-donut-body"><svg viewBox="0 0 200 200" role="img" aria-label={label}>
  <title>{label}</title><circle cx="100" cy="100" r="68" fill="none" stroke="#eef2f4" strokeWidth="29"/>
  {items.map((s,i)=>{const percent=total>0?s.amountSatang/total*100:0,start=offset;offset+=percent;return <circle key={s.label} cx="100" cy="100" r="68" fill="none" stroke={s.color??palette[i%palette.length]} strokeWidth="29" pathLength="100" strokeDasharray={`${percent} ${100-percent}`} strokeDashoffset={-start} transform="rotate(-90 100 100)"><title>{`${s.label}: ${money(s.amountSatang)} บาท (${percent.toFixed(1)}%)`}</title></circle>;})}
  <text x="100" y="94" textAnchor="middle" fontSize="11" fill="#738493">รวม (บาท)</text><text x="100" y="117" textAnchor="middle" fontSize="16" fontWeight="700" fill="#233d4d">{money(total)}</text>
 </svg><div className="accounting-legend">{!items.length?<p className="muted">ไม่มีรายการในช่วงนี้</p>:items.map((s,i)=><div className="accounting-legend-row" key={s.label}><span className="accounting-dot" style={{background:s.color??palette[i%palette.length]}}/><span title={s.label}>{s.label}</span><strong>{money(s.amountSatang)}<small>{total>0?(s.amountSatang/total*100).toFixed(1):'0.0'}%</small></strong></div>)}</div></div>;
}
function Bars({data,flow}:{data:DashboardData;flow:boolean}){
 const [end,setEnd]=useState(data.rows.length),[selected,setSelected]=useState<number|null>(null),id=useId();
 useEffect(()=>{setEnd(data.rows.length);setSelected(null);},[data]);
 const stop=Math.min(end,data.rows.length),start=Math.max(0,stop-10),rows=data.rows.slice(start,stop);
 const values=rows.flatMap(r=>flow?[r.revenueSatang,r.expenseSatang]:[r.profitSatang]);
 const hi=Math.max(0,...values),lo=Math.min(0,...values),span=hi-lo||100,y=(n:number)=>20+(hi-n)/span*130,zero=y(0),step=310/Math.max(1,rows.length);
 const active=selected===null?null:rows[selected];
 return <><div className="accounting-chart-key">{flow?<><span><i style={{background:'#75b6d1'}}/>รายรับ</span><span><i style={{background:'#c1cdd6'}}/>รายจ่าย</span></>:<><span><i style={{background:'#b7e2c5'}}/>กำไร</span><span><i style={{background:'#f2bdc2'}}/>ขาดทุน</span></>}</div>
 <svg className="accounting-bars" viewBox="0 0 390 194" role="img" aria-labelledby={id}><title id={id}>{flow?'กราฟรายรับและรายจ่าย':'แผนภูมิกำไรขาดทุน'+(data.view==='year'?'รายปี':data.view==='month'?'รายเดือน':'รายวัน')}</title>
 {[hi,...(hi&&lo?[0]:[]),...(lo!==hi?[lo]:[])].map((n,i)=><g key={i}><line x1="65" x2="378" y1={y(n)} y2={y(n)} stroke={n===0?'#a8bac5':'#eaf0f3'}/><text x="58" y={y(n)+4} textAnchor="end" fill="#7c8e99" fontSize="9">{(n/100).toLocaleString('th-TH',{maximumFractionDigits:0,notation:'compact'})}</text></g>)}
 {rows.map((r,i)=>{const x=65+i*step+step*.14,label=r.day.length===10?r.day.slice(5):r.day,vals=flow?[r.revenueSatang,r.expenseSatang]:[r.profitSatang];return <g key={r.day} onClick={()=>setSelected(i)} tabIndex={0} role="button" aria-label={`${r.day} ${flow?'รายรับ '+money(r.revenueSatang)+' รายจ่าย '+money(r.expenseSatang):'สุทธิ '+money(r.profitSatang)} บาท`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(i);}}}>
 <title>{`${r.day} · สุทธิ ${money(r.profitSatang)} บาท`}</title>{vals.map((v,j)=><rect key={j} x={x+(flow?j*step*.32:0)} y={Math.min(y(v),zero)} width={step*(flow?.29:.7)} height={Math.max(1,Math.abs(y(v)-zero))} rx="2" fill={flow?(j===0?'#75b6d1':'#c1cdd6'):v<0?'#f2bdc2':'#b7e2c5'}/>)}<text x={x+step*.35} y="166" textAnchor="end" transform={`rotate(-35 ${x+step*.35} 166)`} fontSize="9" fill="#718693">{label}</text></g>;})}</svg>
 <div className="accounting-chart-bottom">{active?<span>{active.day} · {flow?`รับ ${money(active.revenueSatang)} / จ่าย ${money(active.expenseSatang)}`:`สุทธิ ${money(active.profitSatang)} บาท`}</span>:<span>แตะแท่งกราฟเพื่อดูยอด</span>}{data.rows.length>10&&<span className="accounting-chart-pager"><button type="button" aria-label="ช่วงก่อนหน้า" disabled={start===0} onClick={()=>{setEnd(Math.max(10,stop-10));setSelected(null);}}>‹</button><span>{start+1}–{stop}/{data.rows.length}</span><button type="button" aria-label="ช่วงถัดไป" disabled={stop===data.rows.length} onClick={()=>{setEnd(Math.min(data.rows.length,stop+10));setSelected(null);}}>›</button></span>}</div></>;
}
function Panel({initial,kind}:{initial:DashboardData;kind:Kind}){
 const baseFilters={...initial.range,view:initial.view as DashboardFilters['view']};
 const [data,setData]=useState(initial),[filters,setFilters]=useState<DashboardFilters>(baseFilters),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const baseKey=initial.range.from+'..'+initial.range.to+'..'+initial.view,previousBase=useRef(baseKey);
 useEffect(()=>{if(previousBase.current!==baseKey){previousBase.current=baseKey;setData(initial);setFilters({...initial.range,view:initial.view as DashboardFilters['view']});}},[initial,baseKey]);
 useEffect(()=>{
  if(filters.from===initial.range.from&&filters.to===initial.range.to&&filters.view===initial.view){setData(initial);setLoading(false);setError('');return;}
  const controller=new AbortController();let query;
  try{query=dashboardQuery(filters);}catch(e){setError((e as Error).message);setLoading(false);return;}
  setLoading(true);setError('');
  const timer=setTimeout(()=>{fetch('/api/admin/accounting/dashboard?'+query,{signal:controller.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('โหลดข้อมูลไม่สำเร็จ กรุณาลองเลือกช่วงเวลาอีกครั้ง');return r.json() as Promise<DashboardData>;}).then(setData).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});},300);
  return()=>{clearTimeout(timer);controller.abort();};
 },[filters,initial]);
 return <section className="card accounting-widget" aria-busy={loading}><header><h2>{titles[kind]}</h2><span className="accounting-widget-unit">บาท</span></header>
 <div className="accounting-widget-controls"><select aria-label={'ช่วงเวลา '+titles[kind]} value={filters.view} onChange={e=>setFilters({...filters,view:e.target.value as DashboardFilters['view']})}><option value="day">รายวัน</option><option value="month">รายเดือน</option><option value="year">รายปี</option></select><button type="button" className="accounting-reset" onClick={()=>setFilters(baseFilters)}>ใช้ช่วงด้านบน</button>
 </div><div className="accounting-widget-dates"><label>ตั้งแต่<input aria-label={'ตั้งแต่ '+titles[kind]} type="date" value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}/></label><label>ถึง<input aria-label={'ถึง '+titles[kind]} type="date" value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}/></label>
 </div><div className="accounting-widget-period">{loading?'กำลังโหลด…':data.range.from+' ถึง '+data.range.to}{data.pending&&' · ยอดเบื้องต้น'}</div>
 {error?<div className="accounting-widget-error" role="alert">{error}</div>:<div className="accounting-widget-content" style={{opacity:loading?.45:1}}>
 {(kind==='profit'||kind==='flow')?<><div className="accounting-widget-total" style={kind==='profit'?profitColors(data.total.profitSatang):undefined}>{kind==='profit'?<><small>กำไร / ขาดทุนสุทธิ</small><strong>{money(data.total.profitSatang)}</strong></>:<><small>รายรับ <b>{money(data.total.revenueSatang)}</b></small><small>รายจ่าย <b>{money(data.total.expenseSatang)}</b></small></>}</div><Bars data={data} flow={kind==='flow'}/></>:kind==='expenses'?<><Donut items={data.expenses.slices} total={data.expenses.grossSatang} label="กราฟวงแหวนสัดส่วนค่าใช้จ่าย"/><div className="accounting-chart-bottom">คืน/ลดค่าใช้จ่าย {money(data.expenses.creditsSatang)} · สุทธิ {money(data.expenses.netSatang)}</div></>:<><Donut items={data.sources} total={data.total.revenueSatang} label="กราฟวงแหวนรายรับตามแหล่งที่มา"/><div className="accounting-chart-bottom">ยอดขายที่ยืนยันแล้ว นับออเดอร์ครั้งเดียว</div></>}
 </div>}</section>;
}
export function AccountingDashboard({initial}:{initial:DashboardData}){
 return <div className="accounting-dashboard" aria-label="แดชบอร์ดภาพรวมบัญชี"><Panel initial={initial} kind="profit"/><Panel initial={initial} kind="income"/><Panel initial={initial} kind="expenses"/><Panel initial={initial} kind="flow"/></div>;
}
