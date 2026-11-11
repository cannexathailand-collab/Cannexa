import './customer-list.css';
import {CustomerMessageButton} from '../customer-message-button';
import {loadCustomerLineStatuses} from '@/lib/customer-line-message';
import {activeCustomerProfileFilter} from '@/lib/customer-profile-deletion';
import {customerProductPurchases} from '@/lib/crm-product-purchases';
import {customerOrderRecency,inactiveCustomerLabel} from '@/lib/crm-customer-recency';
import Link from 'next/link';
import {db} from '@/lib/db';
import {canonicalCustomerCode,displayCustomerCode} from '@/lib/customer-code';
import {crmDate,crmMoney,customerLifetimeStats,crmRange} from '@/lib/customer-crm';
import {managers} from '@/lib/accounts';
import {requireAdminPage} from '@/lib/auth';
import {crmTierReport} from '@/lib/crm-tier-report';
import {filterAndSortCustomers} from '@/lib/crm-customer-filters';
import {CrmFiltersForm} from '@/app/crm-filters-form';
import {CrmDashboard} from '@/app/crm-dashboard';
import {buildCrmDashboard} from '@/lib/crm-dashboard';

export default async function Crm({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 await requireAdminPage(managers);
 const now=new Date();
 const p=await searchParams,q=typeof p.q==='string'?p.q.trim().slice(0,100):'',page=Math.max(1,Math.min(100000,Math.trunc(Number(p.page))||1));
 const where={AND:[activeCustomerProfileFilter,{OR:[{conversionId:null},{conversion:{source:'LINE'}}]},...(q?[{OR:[{code:{contains:canonicalCustomerCode(q),mode:'insensitive' as const}},{name:{contains:q,mode:'insensitive' as const}},{phone:{contains:q}},{referrer:{code:{contains:q,mode:'insensitive' as const}}}]}]:[])]};
 const [candidates,membership,stockProducts]=await Promise.all([db.customer.findMany({where,include:{referrer:{select:{name:true,code:true}}},orderBy:{code:'asc'}}),crmTierReport(),db.stockProduct.findMany({select:{code:true,name:true},orderBy:{code:'asc'}})]);
 const product=(p.product??'').trim().toUpperCase();
 const productNames=new Map(stockProducts.map(item=>[item.code,item.name]));
 const productCodes=new Set(stockProducts.map(item=>item.code));
 const allRanked=filterAndSortCustomers(candidates.map(c=>{const summary=membership.summaries.get(c.code)!,life=customerLifetimeStats(summary,c.createdAt);const purchases=customerProductPurchases(summary.allHistory);for(const code of purchases.keys())productCodes.add(code);return {productPurchases:purchases,recency:customerOrderRecency(summary.allHistory,now),code:c.code,customer:c,life,spend:life.purchasedSatang/100,profit:life.pendingCostCount?null:life.profitSatang/100,points:Math.max(0,summary.availablePoints),monthly:life.monthlyAverageSatang/100,frequency:life.monthlyOrderAverage,gap:life.averageGapDays};}),p);
 const productRanked=product?allRanked.filter(row=>row.productPurchases.has(product)):allRanked;
 if(product&&(!p.sort||p.sort==='productFrequencyDesc'))productRanked.sort((a,b)=>b.productPurchases.get(product)!.orders-a.productPurchases.get(product)!.orders||b.productPurchases.get(product)!.quantityMilliG-a.productPurchases.get(product)!.quantityMilliG||a.code.localeCompare(b.code));
 const inactive=p.inactive==='3';
 const inactiveCount=productRanked.filter(row=>row.recency.inactiveThreeMonths).length;
 const ranked=inactive?productRanked.filter(row=>row.recency.inactiveThreeMonths):productRanked;
 const count=ranked.length,customers=ranked.slice((page-1)*50,page*50).map(r=>r.customer);
 const lineStatuses=await loadCustomerLineStatuses(customers);
 const dashboard=buildCrmDashboard(ranked.map(r=>({code:r.code,name:r.customer.name,tier:membership.tiers.get(r.code)?.name??'ลูกค้าใหม่',history:membership.summaries.get(r.code)!.allHistory})));
 const range=crmRange(p),view=['month','year'].includes(p.view??'')?p.view!:'day',filters={...range,view};
 const detailQuery=new URLSearchParams(filters).toString();
 const query=Object.fromEntries(Object.entries(p).filter(([key,value])=>!['page','saved','tiersSaved'].includes(key)&&typeof value==='string')) as Record<string,string>;
 const recencyHref=(bucket?:string)=>{const next={...query};delete next.inactive;if(bucket)next.inactive=bucket;return '/admin/crm?'+new URLSearchParams(next);};
 const metricLabel=p.sort==='spendDesc'?'ยอดซื้อสำเร็จสะสม':p.sort==='profitDesc'?'กำไรสะสมหลังต้นทุนสินค้า':p.sort==='pointsDesc'?'Green Coin':p.sort==='monthlyDesc'?'ยอดซื้อเฉลี่ยต่อเดือน':p.sort==='gapAsc'?'ระยะห่างเฉลี่ยระหว่างการซื้อ':'จำนวนครั้งที่ซื้อเฉลี่ยต่อเดือน';
 return <><h1>CRM</h1><p>ข้อมูลลูกค้า ยอดสั่งซื้อสะสม และประวัติการซื้อ แยกตามรหัสลูกค้า</p>
 <p><Link className="button" href="/admin/crm/create">สมัครสมาชิกให้ลูกค้า</Link></p>
 <form action="/admin/crm" className="crm-toolbar">{Object.entries(query).filter(([key])=>!['product','sort'].includes(key)).map(([key,value])=><input key={key} type="hidden" name={key} value={value}/>)}<input type="hidden" name="sort" value="productFrequencyDesc"/><label className="crm-search">สินค้าที่ลูกค้าซื้อ<select name="product" defaultValue={product}><option value="">สินค้าทั้งหมด</option>{[...productCodes].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(code=><option key={code} value={code}>{code+' · '+(productNames.get(code)?.trim()||'—')}</option>)}</select></label><button type="submit">ดูผู้ซื้อสินค้า</button></form><CrmFiltersForm params={p} key={JSON.stringify(p)}/><section className="crm-inactive-section" aria-label="ติดตามลูกค้าที่ไม่ได้สั่งซื้อ"><nav className="crm-inactive-groups" aria-label="ลูกค้าที่ไม่ได้สั่งซื้อ 3 เดือน"><Link href={recencyHref('3')} aria-current={inactive?'page':undefined}><span>{inactiveCustomerLabel}</span><strong>{inactiveCount.toLocaleString('th-TH')} คน</strong><small>ดูรายชื่อ →</small></Link></nav>{inactive&&<p><Link href={recencyHref()}>กลับไปดูลูกค้าทั้งหมด</Link></p>}<p className="muted small">นับตั้งแต่ 90 วันขึ้นไปจากวันที่สั่งซื้อล่าสุด รวมออเดอร์รอจัดส่งและรอรับ COD ไม่นับยกเลิกหรือเคลม</p></section><CrmDashboard data={dashboard}/><p>พบ {count.toLocaleString('th-TH')} ลูกค้า · {product?'ซื้อสินค้า '+product+' · '+(productNames.get(product)?.trim()||'—')+' จากออเดอร์ซื้อสำเร็จตลอดอายุลูกค้า':'จัดอันดับจากยอดซื้อสำเร็จตลอดอายุลูกค้า'}</p>
 <section className="card"><div className="table-wrap"><table><thead><tr><th>ลำดับ</th><th>ลูกค้า</th>{product&&<th>ซื้อสินค้านี้</th>}<th>{metricLabel}</th><th>Member</th><th>Green Coin คงเหลือ</th><th>ไม่รับสินค้า</th><th>ซื้อสำเร็จล่าสุด</th><th>การสั่งซื้อล่าสุด</th><th>ติดต่อผ่าน LINE</th></tr></thead><tbody>{customers.map((c,index)=>{const productStats=ranked[(page-1)*50+index].productPurchases.get(product);const all=membership.summaries.get(c.code)!,life=customerLifetimeStats(all,c.createdAt),recency=customerOrderRecency(all.allHistory,now);const href='/admin/crm/'+encodeURIComponent(c.code)+'?'+detailQuery;const value=p.sort==='spendDesc'?crmMoney(life.purchasedSatang):p.sort==='profitDesc'?(life.pendingCostCount?'รอต้นทุน':crmMoney(life.profitSatang)):p.sort==='pointsDesc'?Math.max(0,all.availablePoints).toLocaleString('th-TH')+' Green Coin':p.sort==='monthlyDesc'?crmMoney(life.monthlyAverageSatang):p.sort==='gapAsc'?(life.averageGapDays===null?'ยังไม่พอคำนวณ':life.averageGapDays.toFixed(1)+' วัน'):life.monthlyOrderAverage.toFixed(2)+' ครั้ง/เดือน';return <tr key={c.code}><td>{(page-1)*50+index+1}</td><th scope="row"><Link className="crm-customer-link" href={href} aria-label={'ดูข้อมูลลูกค้า '+(c.name||displayCustomerCode(c.code))}><strong>{c.name??'ยังไม่ผูกชื่อผู้รับ'}</strong><span className="muted">{displayCustomerCode(c.code)} · {c.phone??'ยังไม่ผูกเบอร์'}</span></Link></th>{productStats&&<td><strong>{productStats.orders} ออเดอร์</strong><div className="muted small">{(productStats.quantityMilliG/1000).toLocaleString('th-TH',{maximumFractionDigits:3})} G</div></td>}<td><strong>{value}</strong></td><td><span className="pill">{membership.tiers.get(c.code)?.name??'ลูกค้าใหม่'}</span></td><td>{Math.max(0,all.availablePoints).toLocaleString('th-TH')} Green Coin</td><td><Link href={'/admin/crm/'+encodeURIComponent(c.code)+'?returns=1'}>{all.lifetimeReturnedCount} ออเดอร์<div className="muted">{all.lifetimeReturnPercent===null?'ยังไม่มีรายการจัดส่ง':all.lifetimeReturnPercent.toFixed(1)+'%'}</div><small>ดูรายการ</small></Link></td><td>{crmDate(life.lastPurchaseAt)}</td><td>{recency.inactiveThreeMonths&&<span className="pill warn">{inactiveCustomerLabel}</span>}<div className="muted small">{crmDate(recency.lastOrderAt)}</div></td><td><CustomerMessageButton code={c.code} name={c.name} status={lineStatuses.get(c.code)!}/></td></tr>;})}</tbody></table></div>{!customers.length&&<p>ไม่พบลูกค้า</p>}</section>
 <div className="filters">{page>1&&<Link href={'?'+new URLSearchParams({...query,page:String(page-1)})}>หน้าก่อน</Link>}{page*50<count&&<Link href={'?'+new URLSearchParams({...query,page:String(page+1)})}>หน้าถัดไป</Link>}</div>
 <p className="muted">ยอดสั่งซื้อสะสมไม่รวมยกเลิก คืนสินค้า และเคลม ยอดซื้อสำเร็จใช้เกณฑ์เดียวกับหน้ายอดขาย ส่วน COD ที่ยังไม่ได้รับเงินและออเดอร์ที่ยังไม่ผ่านเงื่อนไขจะแยกเป็นยอดรอดำเนินการ รายการไม่ทราบยอดจะไม่ถูกประมาณเป็นยอดซื้อ</p></>;
}
