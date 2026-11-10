import {CustomerDashboard} from '@/app/customer-dashboard';
import {buildCustomerDashboard} from '@/lib/customer-dashboard';
import {customerOrderRecency,inactiveCustomerLabel} from '@/lib/crm-customer-recency';
import {PopupDetails} from '@/app/popup-details';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {db} from '@/lib/db';
import {canonicalCustomerCode,displayCustomerCode} from '@/lib/customer-code';
import {crmDate,crmMoney,loadCustomerCrm,customerLifetimeStats,crmRange,crmBehaviorTags,type CrmFilters} from '@/lib/customer-crm';
import {customerTags} from '@/lib/customer-tags';
import {crmTierReport} from '@/lib/crm-tier-report';
import {customerOrderTeams} from '@/lib/customer-order-teams';
import {managers} from '@/lib/accounts';
import {requireAdminPage} from '@/lib/auth';
import {CustomerAccessButton} from '../customer-access-button';

export default async function CustomerProfile({params,searchParams}:{params:Promise<{code:string}>;searchParams:Promise<CrmFilters>}){
 await requireAdminPage(managers);
 const code=canonicalCustomerCode((await params).code);
 const customer=await db.customer.findFirst({where:{code,OR:[{conversionId:null},{conversion:{source:'LINE'}}]},include:{referrer:{select:{name:true,code:true}}}});
 if(!customer)notFound();
 const p=await searchParams,range=crmRange(p),view=['month','year'].includes(p.view??'')?p.view!:'day';
 const summary=(await loadCustomerCrm([code],{...range,view})).get(code)!,life=customerLifetimeStats(summary,customer.createdAt);
 const dashboard=buildCustomerDashboard(summary.allHistory,p.from||p.to?range:undefined);
 const productNames=new Map((dashboard.products.length?await db.stockProduct.findMany({where:{code:{in:dashboard.products.map(product=>product.code)}},select:{code:true,name:true}}):[]).map(product=>[product.code,product.name]));
 const recency=customerOrderRecency(summary.allHistory);
 const historyRows=p.returns==='1'?summary.history.filter(h=>h.returned):summary.history;
 const historyQuery=new URLSearchParams({...range,view});
 const groupIds=[...new Set(summary.allHistory.map(h=>h.order.groupKey))];
 const groups=groupIds.length?await db.orderGroup.findMany({where:{id:{in:groupIds}},select:{id:true,botId:true,name:true}}):[];
 const bots=groups.length?await db.orderBot.findMany({where:{botId:{in:groups.map(g=>g.botId)}},select:{botId:true,name:true}}):[];
 const teams=customerOrderTeams(summary.allHistory.map(h=>h.order),groups,bots);
 const membership=await crmTierReport(),tier=membership.tiers.get(code);
 return <div className="crm-customer-profile"><Link href="/admin/crm">← กลับ CRM</Link><h1>ลูกค้า {displayCustomerCode(code)}</h1>
 <CustomerAccessButton code={code} linked={!!customer.lineUserKey}/>
 <section className="card"><h2>Member: {tier?.name??'ลูกค้าใหม่'}</h2>{tier?.rank&&<p>อันดับยอดซื้อสะสม {tier.rank} จากลูกค้าที่ซื้อสำเร็จ {tier.buyers} คน</p>}<p className="muted">ระดับประจำเดือน {tier?.reviewMonth} · ประเมินจากเดือน {tier?.assessedMonth} · ไม่ผ่านต่อเนื่อง {tier?.failedMonths??0}/2 เดือน{tier?.decision==='WAITING_COST'?' · รอต้นทุน คงระดับเดิม':''}</p><h2>แท็กลูกค้าอัตโนมัติ</h2>{[tier?.name??'ลูกค้าใหม่',...customerTags(customer,teams),...crmBehaviorTags(summary)].filter((tag,index,tags)=>tags.indexOf(tag)===index).map(tag=><span className="pill" style={{margin:4}} key={tag}>{tag}</span>)}<p className="muted">อัปเดตจากประวัติทั้งหมดของลูกค้าใน CRM ไม่เปลี่ยนตามตัวกรองวันที่</p></section>
 <section className="card"><h2>{customer.name??'ยังไม่ผูกชื่อผู้รับ'}</h2><p>เบอร์โทร: {customer.phone??'ยังไม่ผูกเบอร์'}<br/>ผู้แนะนำ: {customer.legacy?'ลูกค้าเก่า':customer.referrer?customer.referrer.name+' · '+customer.referrer.code:'ยังไม่ระบุ'}<br/>ทีม/ร้าน: {teams.join(', ')||'ยังไม่มีออเดอร์ระบุทีม'}<br/>เป็นลูกค้าตั้งแต่ (ข้อมูลแรกที่มี): {crmDate(life.since)} · {life.days} วัน<br/>สร้างรหัสเมื่อ: {crmDate(customer.createdAt)}</p></section>
 <p className="crm-order-recency">{recency.inactiveThreeMonths&&<><strong>{inactiveCustomerLabel}</strong> · </>}สั่งซื้อล่าสุด {crmDate(recency.lastOrderAt)}</p><h2>ภาพรวมตลอดอายุลูกค้า</h2><section className="stats">{[['ยอดสั่งซื้อสะสมทั้งหมด',crmMoney(life.orderedSatang)],['จำนวนออเดอร์สะสม',life.orderCount+' ออเดอร์'],['ยอดซื้อสำเร็จสะสม',crmMoney(life.purchasedSatang)],['กำไรหลังต้นทุนสินค้า',crmMoney(life.profitSatang)+(life.pendingCostCount?' · รอต้นทุน '+life.pendingCostCount+' ออเดอร์':'')],['กำไรเฉลี่ยต่อเดือน',life.monthlyProfitAverageSatang===null?'รอต้นทุนครบ · '+life.pendingCostCount+' ออเดอร์':crmMoney(life.monthlyProfitAverageSatang)],['ยอดซื้อเฉลี่ยต่อเดือน',crmMoney(life.monthlyAverageSatang)],['จำนวนซื้อเฉลี่ยต่อเดือน',life.monthlyOrderAverage.toFixed(2)+' ครั้ง'],['ยอดเฉลี่ยต่อการซื้อ',life.averageOrderSatang===null?'ยังไม่มีข้อมูล':crmMoney(life.averageOrderSatang)],['ระยะห่างเฉลี่ยระหว่างการซื้อ',life.averageGapDays===null?'ยังไม่พอคำนวณ':life.averageGapDays.toFixed(1)+' วัน'],['ซื้อสำเร็จล่าสุด',crmDate(life.lastPurchaseAt)],['Green Coin สะสมทั้งหมด',summary.lifetimePoints.toLocaleString('th-TH')+' Green Coin'],['Green Coin ใช้แลก',summary.redeemedPoints.toLocaleString('th-TH')+' Green Coin'],['Green Coin คงเหลือ',Math.max(0,summary.availablePoints).toLocaleString('th-TH')+' Green Coin'],['ไม่รับสินค้า (ทั้งหมด)',summary.lifetimeReturnedCount+' ออเดอร์'],['อัตราไม่รับสินค้า (ทั้งหมด)',summary.lifetimeReturnPercent===null?'ยังไม่มีรายการจัดส่ง':summary.lifetimeReturnPercent.toFixed(1)+'%']].map(([label,value])=>label==='กำไรเฉลี่ยต่อเดือน'?<PopupDetails className="card stat crm-monthly-profit" summary={<><span>{label}</span><strong>{value}</strong><small>ดูรายละเอียดการคำนวณ</small></>} title="กำไรเฉลี่ยต่อเดือนของลูกค้า" key={label}>
 <p>ช่วงข้อมูล {crmDate(life.since)} ถึง {crmDate(new Date())}</p>
 <p>กำไรหลังต้นทุนสินค้า{life.pendingCostCount?'ที่ข้อมูลครบแล้ว':''} <strong>{crmMoney(life.profitSatang)}</strong></p>
 <p>จำนวนเดือนที่นำมาหาร <strong>{life.months} เดือน</strong> รวมเดือนที่ลูกค้าไม่ได้ซื้อ</p>
 {life.monthlyProfitAverageSatang===null?<p className="notice">รอต้นทุนครบ {life.pendingCostCount} ออเดอร์ จึงจะสรุปกำไรเฉลี่ยได้</p>:<p>กำไรเฉลี่ยต่อเดือน = {crmMoney(life.profitSatang)} ÷ {life.months} เดือน = <strong>{crmMoney(life.monthlyProfitAverageSatang)}</strong></p>}
 <p className="muted small">ใช้เฉพาะออเดอร์ที่รับรู้ยอดขายแล้วตามเกณฑ์ CRM และหักต้นทุนสินค้า</p>
 </PopupDetails>:<article className="card stat" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
 <p className="muted">ค่าเฉลี่ยรายเดือนหารด้วยจำนวนเดือนปฏิทินตั้งแต่เป็นลูกค้าจนถึงเดือนปัจจุบัน รวมเดือนที่ไม่ได้ซื้อ กำไรเฉลี่ยใช้กำไรหลังต้นทุนสินค้า และแสดงรอต้นทุนครบเมื่อข้อมูลยังไม่ครบ ส่วนระยะห่างเฉลี่ยคำนวณจากวันที่สั่งซื้อสำเร็จแต่ละครั้ง</p>
 <CustomerDashboard data={dashboard} productNames={productNames}/>
 <h2>ดูข้อมูลตามช่วงเวลา</h2><form className="filters">{p.returns==='1'&&<input type="hidden" name="returns" value="1"/>}<label>ตั้งแต่<input type="date" name="from" defaultValue={p.from??''}/></label><label>ถึง<input type="date" name="to" defaultValue={p.to??''}/></label><label>สรุปตาม<select name="view" defaultValue={view}><option value="day">รายวัน</option><option value="month">รายเดือน</option><option value="year">รายปี</option></select></label><button type="submit">แสดงข้อมูล</button></form>
 <section className="stats">{[['ยอดสั่งซื้อสะสม',crmMoney(summary.orderedSatang)],['ยอดซื้อสำเร็จ',crmMoney(summary.purchasedSatang)],['ซื้อสำเร็จ',summary.purchaseCount+' ครั้ง'],['ยอดรอดำเนินการ',crmMoney(summary.pendingSatang)],['ไม่รับสินค้าในช่วงที่เลือก',summary.returnedCount+' ออเดอร์'],['อัตราไม่รับสินค้าในช่วงที่เลือก',summary.returnPercent===null?'ยังไม่มีรายการจัดส่ง':summary.returnPercent.toFixed(1)+'%']].map(([label,value])=><article className="card stat" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
 <p>สั่งซื้อทั้งหมด {summary.orderCount} ออเดอร์ · สั่งซื้อล่าสุด {crmDate(summary.lastOrderedAt)}{summary.unknownAmountCount>0&&' · ยังไม่ทราบยอด '+summary.unknownAmountCount+' รายการ'}</p>
 <section className="card"><h2>ยอดซื้อและกำไร{view==='year'?'รายปี':view==='month'?'รายเดือน':'รายวัน'}</h2><div className="table-wrap"><table><thead><tr><th>งวด</th><th>ยอดซื้อสำเร็จ</th><th>กำไรหลังต้นทุนสินค้า</th><th>Green Coin ที่ได้รับ</th></tr></thead><tbody>{summary.periods.map(row=><tr key={row.period}><td>{row.period}</td><td>{crmMoney(row.revenueSatang)}</td><td>{crmMoney(row.profitSatang)}{row.pendingCost>0&&' · รอต้นทุน '+row.pendingCost+' ออเดอร์'}</td><td>{row.points}</td></tr>)}</tbody></table></div>{!summary.periods.length&&<p>ยังไม่มียอดซื้อสำเร็จในช่วงที่เลือก</p>}</section>
 <section className="card"><h2>{p.returns==='1'?'รายการไม่รับสินค้า':'ประวัติการสั่งซื้อ'}</h2><p><Link className="button secondary" href={'?'+historyQuery.toString()}>ทุกออเดอร์</Link> <Link className="button secondary" href={'?'+historyQuery.toString()+'&returns=1'}>เฉพาะไม่รับสินค้า</Link></p><div className="table-wrap"><table><thead><tr><th>วันที่สั่งซื้อ</th><th>ออเดอร์</th><th>ผู้รับ</th><th>ทีม/ร้าน · ผู้ขาย</th><th>การชำระเงิน</th><th>ยอดสั่งซื้อ</th><th>กำไรหลังต้นทุนสินค้า</th><th>Green Coin</th><th>สถานะ</th><th>เลขพัสดุ</th></tr></thead><tbody>{historyRows.map(h=><tr key={h.order.id}><td>{crmDate(h.order.eventAt)}</td><td>{h.order.orderNumber}</td><td>{h.order.recipient??'—'}</td><td>{customerOrderTeams([h.order],groups,bots).join(', ')}<div className="muted">{h.order.sellerUsername??h.order.sellerCode??'—'}</div></td><td>{h.order.payment??'—'}</td><td>{h.amountSatang===null?'ไม่ทราบยอด':crmMoney(h.amountSatang)}</td><td>{h.profitSatang===null?(h.recognized?'รอต้นทุน':'—'):crmMoney(h.profitSatang)}</td><td>{h.points}</td><td><span className={'pill '+(h.recognized?'': 'warn')}>{h.status}</span></td><td>{h.tracking??'—'}</td></tr>)}</tbody></table></div>{!historyRows.length&&<p>{p.returns==='1'?'ไม่มีรายการไม่รับสินค้าในช่วงที่เลือก':'ยังไม่มีประวัติการสั่งซื้อ'}</p>}</section>
 <p className="muted">อัตราไม่รับสินค้า = จำนวนออเดอร์ที่ตีกลับ ÷ จำนวนออเดอร์ที่จัดส่งแล้ว × 100 ไม่รวมยกเลิก ถอนออเดอร์ หรือรอจัดส่ง</p>
 <p className="muted">ยอดซื้อสำเร็จใช้เกณฑ์เดียวกับหน้ายอดขาย ไม่รวมยกเลิก คืนสินค้า เคลม หรือ COD ที่ยังไม่ได้รับเงิน กำไรใน CRM หักเฉพาะต้นทุนสินค้า ยังไม่หักค่าคอมและค่าใช้จ่ายส่วนกลาง ออเดอร์ที่ต้นทุนไม่ครบจะขึ้นรอต้นทุน ประวัติจะแสดงเฉพาะออเดอร์ที่เชื่อมกับรหัสลูกค้านี้</p></div>;
}
