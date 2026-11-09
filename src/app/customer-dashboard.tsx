import {CrmMonthlyChart} from './crm-dashboard';
import {crmDate,crmMoney} from '@/lib/customer-crm';
import {dayStart} from '@/lib/sales-dates';
import type {CustomerDashboardData} from '@/lib/customer-dashboard';

const count=(value:number)=>value.toLocaleString('th-TH')+' ครั้ง';
const percent=(value:number)=>value.toFixed(1)+'%';
export function CustomerDashboard({data,productNames=new Map()}:{data:CustomerDashboardData;productNames?:ReadonlyMap<string,string|null>}){
 let offset=0;
 const paymentTotal=data.payments.reduce((sum,payment)=>sum+payment.amountSatang,0);
 const comparisons=[
  {label:'ยอดซื้อสำเร็จ',current:data.current.revenueSatang,previous:data.previous.revenueSatang,format:crmMoney},
  {label:'กำไรหลังต้นทุนสินค้าและค่าส่ง',current:data.current.profitSatang,previous:data.previous.profitSatang,format:crmMoney},
  {label:'จำนวนซื้อสำเร็จ',current:data.current.purchases,previous:data.previous.purchases,format:count},
  {label:'ยอดเฉลี่ยต่อการซื้อ',current:data.current.averageOrderSatang,previous:data.previous.averageOrderSatang,format:crmMoney},
  {label:'อัตรากำไรต่อยอดซื้อ',current:data.current.profitMargin,previous:data.previous.profitMargin,format:percent},
 ];
 return <section className="customer-crm-dashboard" aria-label="แดชบอร์ดลูกค้ารายบุคคล">
  <h2>แดชบอร์ดลูกค้า</h2>
  <section className="card"><h3>เปรียบเทียบผลการซื้อ</h3><p className="muted small">ช่วงนี้ {crmDate(dayStart(data.currentRange.from))} – {crmDate(dayStart(data.currentRange.to))} · ช่วงก่อนหน้า {crmDate(dayStart(data.previousRange.from))} – {crmDate(dayStart(data.previousRange.to))} ระยะเวลาเท่ากัน</p>
   <div className="table-wrap"><table className="customer-comparison-table"><thead><tr><th>ตัวชี้วัด</th><th>ช่วงนี้</th><th>ช่วงก่อนหน้า</th><th>เปลี่ยนแปลง</th></tr></thead><tbody>{comparisons.map(row=>{
    const difference=row.current===null||row.previous===null?null:row.current-row.previous;
    const percentageChange=difference===null||row.previous===null||row.previous===0?null:difference/Math.abs(row.previous)*100;
    const changeText=difference===null?'รอข้อมูล':difference===0?'เท่าเดิม':(difference>0?'เพิ่มขึ้น ':'ลดลง ')+(row.format===percent?Math.abs(difference).toFixed(1)+' จุดเปอร์เซ็นต์':row.format(Math.abs(difference)));
    const percentageText=percentageChange===null?'คำนวณเปอร์เซ็นต์ไม่ได้ (ฐานเดิม 0)':(percentageChange>0?'+':'')+percent(percentageChange);
    return <tr key={row.label}><th scope="row">{row.label}</th><td data-label="ช่วงนี้">{row.current===null?'รอข้อมูล':row.format(row.current)}</td><td data-label="ช่วงก่อนหน้า">{row.previous===null?'รอข้อมูล':row.format(row.previous)}</td><td data-label="เปลี่ยนแปลง" className={difference!==null&&difference<0?'comparison-down':'comparison-up'}><span>{changeText}</span>{difference!==null&&<small className="comparison-percentage" title="เทียบกับขนาดของค่าช่วงก่อนหน้า">{percentageText}</small>}</td></tr>;
   })}</tbody></table></div>
   {(data.current.missingCosts>0||data.previous.missingCosts>0)&&<p className="notice">กำไรและอัตรากำไรจะแสดงเมื่อข้อมูลต้นทุนครบ · ช่วงนี้รอ {data.current.missingCosts} ออเดอร์ · ช่วงก่อนหน้ารอ {data.previous.missingCosts} ออเดอร์</p>}
  </section>
  <div className="crm-chart-grid"><CrmMonthlyChart data={data.trend}/>
   <section className="card"><h3>สถานะออเดอร์ทั้งหมด</h3><div className="customer-status-chart"><svg viewBox="0 0 200 200" role="img" aria-label="สัดส่วนสถานะออเดอร์ของลูกค้า"><circle cx="100" cy="100" r="68" fill="none" stroke="#edf1ef" strokeWidth="25"/>{data.statuses.map(status=>{
    const share=data.totalOrders?status.count/data.totalOrders*100:0,start=offset;offset+=share;
    return <circle key={status.key} cx="100" cy="100" r="68" fill="none" stroke={status.color} strokeWidth="25" pathLength="100" strokeDasharray={share+' '+(100-share)} strokeDashoffset={-start} transform="rotate(-90 100 100)"><title>{status.label+' '+status.count+' ออเดอร์'}</title></circle>;
   })}<text x="100" y="100" textAnchor="middle" fontSize="25" fontWeight="700">{data.totalOrders}</text><text x="100" y="120" textAnchor="middle" fontSize="12">ออเดอร์</text></svg><ul>{data.statuses.map(status=><li key={status.key}><i style={{background:status.color}}/><span>{status.label}</span><strong>{status.count}</strong></li>)}</ul></div></section>
  </div>
  <div className="crm-chart-grid">
   <section className="card"><h3>โอนและ COD</h3><p className="muted small">ยอดตามออเดอร์ตลอดอายุลูกค้า รวมรายการรอดำเนินการ หักยกเลิกและตีกลับแล้ว</p>{data.payments.map(payment=><div className="customer-payment-row" key={payment.key}><div><strong>{payment.label}</strong><span>{payment.count} ออเดอร์ · {crmMoney(payment.amountSatang)}</span></div><div className="customer-payment-track"><span style={{width:(paymentTotal?payment.amountSatang/paymentTotal*100:0)+'%',background:payment.key==='COD'?'#9bc7dd':'#a0ceb2'}}/></div>{payment.unknownAmounts>0&&<small>ยังไม่ทราบยอด {payment.unknownAmounts} ออเดอร์</small>}</div>)}</section>
   <section className="card"><h3>สินค้าที่ซื้อบ่อย</h3><p className="muted small">5 อันดับจากออเดอร์ซื้อสำเร็จทั้งหมด</p>{data.products.length?<div className="table-wrap"><table><thead><tr><th>สินค้า</th><th>ออเดอร์</th><th>จำนวนรวม</th></tr></thead><tbody>{data.products.map(product=><tr key={product.code}><th scope="row"><strong>{productNames.get(product.code)?.trim()||'—'}</strong><small className="dashboard-product-code">{product.code}</small></th><td>{product.orders}</td><td>{(product.quantityMilliG/1000).toLocaleString('th-TH',{maximumFractionDigits:3})} G</td></tr>)}</tbody></table></div>:<p className="muted">ยังไม่มีสินค้าจากออเดอร์ซื้อสำเร็จที่อ่านข้อมูลได้ครบ</p>}{data.unreadableProductOrders>0&&<p className="notice">อ่านรายการสินค้าไม่ครบ {data.unreadableProductOrders} ออเดอร์</p>}</section>
  </div>
 </section>;
}
