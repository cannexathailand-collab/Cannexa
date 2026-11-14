import {employeeLanguage} from '@/lib/employee-language-server';
import {employeeHistoryPage,employeeOrderScope} from '@/lib/employee-order-history';
import {OrderDocumentButtons} from '@/app/order-document-buttons';
import {OrderShippingDetails} from '@/app/order-shipping-details';
import {loadOrderShippingItems} from '@/lib/order-shipping-items';
import {employeeCommissions} from '@/lib/employee-commissions';
import {OrderCommissionStatus,orderCommissionCopyLines} from '../order-commission-status';
import {orderMatchesState} from '@/lib/order-management';
import Link from 'next/link';
import {requireEmployeePage} from '@/lib/employee-view';
import {CancelOwnOrderButton} from '@/app/cancel-own-order-button';
import {employeeOrderDashboard} from '@/lib/employee-order-dashboard';
import {loadDuplicateOrderReviews} from '@/lib/order-duplicates';
import {DuplicateOrderNotice} from '@/app/duplicate-order-notice';
import {EmployeeNav} from '../employee-nav';
import {EmployeeOrderSummary} from '../employee-order-summary';
import {currentAccount} from '@/lib/auth';
import {canReviewWebsiteOrders} from '@/lib/website-review-permissions';
import {listWebsiteOrders} from '@/lib/website-orders';
import {WebsiteReviewList} from '../website-review-list';
import {OrderCustomerLineLink} from '../order-customer-line-link';
export default async function EmployeeOrders({searchParams}:{searchParams:Promise<{status?:string;q?:string;page?:string;scope?:string;range?:string}>}){
 const {t,locale,language}=await employeeLanguage();

 const actor=await requireEmployeePage();
 const input=await searchParams;
 const mine=employeeOrderScope(input)==='mine';
 const account=await currentAccount();
 const websiteOrders=!mine&&canReviewWebsiteOrders(account)?await listWebsiteOrders('PENDING_REVIEW'):[];
 const [data,duplicates,commissions]=await Promise.all([employeeOrderDashboard({q:input.q,page:input.page,scope:input.scope,range:input.range},actor.username),loadDuplicateOrderReviews(),mine&&actor.affiliateId?employeeCommissions(actor.affiliateId):Promise.resolve({rows:[]})]);
 const status=!data.query&&['WAITING','SHIPPED','RETURNED','REVIEW','CANCELLED'].includes(input.status??'')?input.status!:'ALL';
 const labels:Record<string,string>={ALL:data.range==='all'?(mine?'ออเดอร์ของฉันทุกช่วงวันที่':'ออเดอร์ทั้งหมดในระบบ'):data.page===1?'ออเดอร์ในรอบวันนี้':'ออเดอร์ในรอบที่เลือก',WAITING:'รอจัดส่ง',SHIPPED:'จัดส่งแล้ว',RETURNED:'ตีกลับ / จัดส่งไม่สำเร็จ',REVIEW:'ต้องตรวจสอบ',CANCELLED:'ยกเลิก / ปิดรายการ'};
 const history=data.range==='all'?employeeHistoryPage(data.todayRows,status,input.page):null;
 const rows=history?.rows??data.todayRows.filter(row=>orderMatchesState(row,status));
 const count=history?.count??rows.length;
 const scopeQuery:Record<string,string>={...(mine?{scope:'mine'}:{}),...(data.range==='all'?{range:'all'}:{}),...(data.query?{q:data.query}:{}),status};
 const listQuery=new URLSearchParams({...scopeQuery,page:String(history?.page??data.page)}).toString();
 const shipping=await loadOrderShippingItems(rows);
 return <main className="center-page performance-page"><section className="customer employee-orders-page"><h1>{t("รายการออเดอร์")}</h1><p className="muted">{t("ออเดอร์รวมของพนักงานทุกคนที่บันทึกในระบบแล้ว")}</p><EmployeeNav active="orders"/><form method="get" className="employee-order-search">{data.range==='all'&&<input type="hidden" name="range" value="all"/>}<label>{t("ค้นหาอิสระทั้งระบบ")}<input name="q" defaultValue={data.query} placeholder={t("เลขพัสดุ เลขออเดอร์ ชื่อลูกค้า เบอร์โทร หรือรหัสลูกค้า")}/></label><button>{t("ค้นหา")}</button>{data.query&&<Link href={'/my-performance/orders?'+new URLSearchParams({...(mine?{scope:'mine'}:{}),...(data.range==='all'?{range:'all'}:{})})}>{t("ล้างคำค้น")}</Link>}</form><EmployeeOrderSummary data={data} shared={!mine} websitePendingCount={websiteOrders.length}/>{(status==='ALL'||status==='REVIEW')&&<WebsiteReviewList orders={websiteOrders} language={language} sellerCode={actor.username} selfReview={account.role==='employee'}/> }
 <h2>{data.query?t('ผลการค้นหาทั้งระบบ'):t(labels[status])} · {count} {t(" รายการ")}</h2>{data.range==='all'&&<p className="muted small">{t("แสดงหน้า ")}{history!.page} / {history!.pages} {t(" · หน้าละ 25 รายการ")}</p>}<div className="employee-order-list store-preparing-list">{rows.map(order=><article className={'employee-order-card'+(duplicates.has(order.id)?' duplicate-order-row':'')} key={order.id}><header><div><strong><Link className="employee-order-reference" title={t("เปิดรายละเอียดออเดอร์")} aria-label={t('ดูรายละเอียดออเดอร์ ')+order.orderNumber} href={'/my-performance/orders/'+encodeURIComponent(order.id)+'?'+listQuery}>{order.orderNumber}</Link></strong><small>{t("สร้าง ")}{order.createdAt.toLocaleString(locale,{timeZone:'Asia/Bangkok',second:'2-digit',minute:'2-digit',hour:'2-digit',year:'numeric',month:'short',day:'numeric'})}</small></div><span className="employee-order-status">{order.state==='CANCELLED'?t('ยกเลิก / ปิดรายการ'):order.state==='RETURNED'?t('ตีกลับ'):order.hasTracking?t('จัดส่งแล้ว'):t('รอจัดส่ง')}</span></header><p>{t("รอบ ")}{order.day}</p><OrderShippingDetails language={language} orderId={order.id} documentActions={<OrderDocumentButtons orderId={order.id}/>} teamName={order.teamName} copyDetails={{orderNumber:order.orderNumber,seller:order.sellerUsername,createdAt:order.createdAt,status:order.state==='CANCELLED'?'ยกเลิก / ปิดรายการ':order.state==='RETURNED'?'ตีกลับ':order.hasTracking?'จัดส่งแล้ว':'รอจัดส่ง',extraLines:orderCommissionCopyLines({visible:mine,payment:order.payment,codReceived:order.codReceived,rows:commissions.rows.filter(row=>row.reference===order.orderNumber)})}} data={{recipient:order.recipient,phone:order.phone,address:order.address,payment:order.payment,amountSatang:order.revenueSatang,items:shipping.get(order.id)!.items}} tracking={order.tracking}><OrderCustomerLineLink code={order.customerCode??null}/>{order.canCancel&&(actor.role==='owner'||order.sellerUsername===actor.username)&&<CancelOwnOrderButton id={order.id} version={order.version} orderNumber={order.orderNumber}/>}</OrderShippingDetails><OrderCommissionStatus language={language} visible={mine} payment={order.payment} codReceived={order.codReceived} rows={commissions.rows.filter(row=>row.reference===order.orderNumber)}/><DuplicateOrderNotice matches={duplicates.get(order.id)??[]} currentOrder={order} baseHref="/my-performance/orders/"/></article>)}{!rows.length&&<p className="empty">{t("ไม่มีออเดอร์ในช่วงนี้")}</p>}</div>{history&&<nav className="commission-pagination" aria-label={t("หน้ารายการออเดอร์ทั้งหมด")}>{history.page>1&&<Link href={'/my-performance/orders?'+new URLSearchParams({...scopeQuery,page:String(history.page-1)})}>{t("← หน้าก่อนหน้า")}</Link>}<span>{t("หน้า ")}{history.page} / {history.pages}</span>{history.page<history.pages&&<Link href={'/my-performance/orders?'+new URLSearchParams({...scopeQuery,page:String(history.page+1)})}>{t("หน้าถัดไป →")}</Link>}</nav>}{!history&&!data.query&&<nav className="commission-pagination" aria-label={t("เลือกรอบออเดอร์")}>{data.page<data.pages&&<Link href={'/my-performance/orders?'+new URLSearchParams({...scopeQuery,page:String(data.page+1),status})}>{t("← รอบก่อนหน้า")}</Link>}<span>{t("รอบวันที่ ")}{data.currentRound}</span>{data.page>1&&<Link href={'/my-performance/orders?'+new URLSearchParams({...scopeQuery,page:String(data.page-1),status})}>{t("รอบถัดไป →")}</Link>}</nav>}
 </section></main>;
}
