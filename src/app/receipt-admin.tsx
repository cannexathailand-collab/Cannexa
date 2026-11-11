import {visibleOrderWhere} from '@/lib/order-list-visibility';
import {TaxInvoiceSettingsForm} from './tax-invoice-settings-form';
import {bangkokDay} from '@/lib/sales-dates';
import {db} from '@/lib/db';
import {quotedTotal} from '@/lib/shipment-matching';
import {receiptPaymentAmount} from '@/lib/receipt-payment';
import {ReceiptSettingsForm} from './receipt-settings-form';
import {ReceiptButton} from './receipt-button';

export async function ReceiptAdmin({query='',base='/admin/receipts',issueEndpoint,receiptBase,settingsEndpoint,taxSettingsEndpoint,taxEditorBase='/admin/tax-invoices',taxDocumentBase='/tax-invoices',readOnly=false}:{query?:string;base?:string;issueEndpoint?:string;receiptBase?:string;settingsEndpoint?:string;taxSettingsEndpoint?:string;taxEditorBase?:string;taxDocumentBase?:string;readOnly?:boolean}){
 const [settings,taxSettings,orders]=await Promise.all([
  db.receiptSettings.findUnique({where:{id:'active'}}),
  db.taxInvoiceSettings.findUnique({where:{id:'active'}}),
  db.orderIntake.findMany({where:{AND:[visibleOrderWhere,query?{OR:[{orderNumber:{contains:query,mode:'insensitive'}},{recipient:{contains:query,mode:'insensitive'}},{customerCode:{contains:query,mode:'insensitive'}}]}:{}]},orderBy:{eventAt:'desc'},take:100}),
 ]);
 const ids=orders.map(order=>order.id);
 const [shipments,sales,issued,taxIssued]=await Promise.all([db.shipment.findMany({where:{orderId:{in:ids}}}),db.salesOrder.findMany({where:{orderId:{in:ids}}}),db.customerReceipt.findMany({where:{orderId:{in:ids}}}),db.customerTaxInvoice.findMany({where:{orderId:{in:ids}}})]);
 const receipts=await db.codReceipt.findMany({where:{tracking:{in:shipments.map(shipment=>shipment.tracking)}}});
 const shipping=new Map(shipments.map(row=>[row.orderId,row])),saleByOrder=new Map(sales.map(row=>[row.orderId,row])),cod=new Map(receipts.map(row=>[row.tracking,row.amountSatang])),documents=new Map(issued.map(row=>[row.orderId,row]));
 const taxes=new Map(taxIssued.map(row=>[row.orderId,row]));
 return <>
  <div className="intro"><div><div className="eyebrow">บัญชี</div><h1>ใบเสร็จรับเงินและใบกำกับภาษี</h1><p className="muted">ออกเลขเอกสารและบันทึกสำเนาอัตโนมัติเมื่อกดใบเสร็จ พิมพ์ บันทึก PDF หรือคัดลอกข้อความเพื่อส่งลูกค้าได้</p></div></div>
  {!readOnly&&<section className="card"><h2>ข้อมูลผู้ออกใบเสร็จ</h2><p className="muted">ข้อมูลนี้ใช้สำหรับร้านนี้ ใบเสร็จที่ออกไปแล้วเก็บข้อมูลตามวันที่ออกเอกสาร</p><ReceiptSettingsForm initial={settings} endpoint={settingsEndpoint}/></section>}
  {!readOnly&&<section className="card"><h2>การตั้งค่าใบกำกับภาษี</h2><TaxInvoiceSettingsForm initial={taxSettings?{...taxSettings,registeredOn:taxSettings.registeredOn?bangkokDay(taxSettings.registeredOn):null}:null} endpoint={taxSettingsEndpoint}/></section>}
  <section className="card"><h2>ออเดอร์และเอกสาร</h2><form method="get" action={base} className="actions"><input name="q" placeholder="ค้นหาเลขออเดอร์ ชื่อลูกค้า หรือรหัสลูกค้า" defaultValue={query} maxLength={100} aria-label="ค้นหาออเดอร์"/><button>ค้นหา</button></form><p className="muted">แสดงล่าสุดไม่เกิน 100 ออเดอร์ · ยอดโอนใช้ข้อมูลที่บันทึกในออเดอร์ ส่วน COD ใช้รายงานรับเงินที่จับคู่แล้ว</p>
  <div className="table-wrap"><table><thead><tr><th>ออเดอร์ / ลูกค้า</th><th>ยอดรับเงิน</th><th>ใบเสร็จ</th><th>ใบกำกับภาษี</th></tr></thead><tbody>{orders.map(order=>{
   const shipment=shipping.get(order.id)??null,document=documents.get(order.id);
   const amount=document?.amountSatang??receiptPaymentAmount(order,quotedTotal(order.rawText??'')??saleByOrder.get(order.id)?.revenueSatang??null,shipment,shipment?cod.get(shipment.tracking)??null:null);
   return <tr key={order.id}><td>{order.orderNumber}<br/>{order.recipient||order.customerCode||'—'}</td><td>{amount===null?'รอตรวจสอบการรับเงิน':(amount/100).toLocaleString('th-TH',{minimumFractionDigits:2})+' บาท'}</td><td>{document?<a href={(receiptBase??'/receipts')+'/'+document.id}>{document.number}</a>:amount!==null&&!readOnly&&settings?.enabled?<ReceiptButton orderId={order.id} endpoint={issueEndpoint} receiptBase={receiptBase}/>:<span className="muted">{!settings?.enabled?'รอตั้งค่าผู้ออกใบเสร็จ':'ยังไม่มีใบเสร็จ'}</span>}</td><td>{taxes.has(order.id)?<a href={taxDocumentBase+'/'+taxes.get(order.id)!.id}>{taxes.get(order.id)!.number}</a>:!readOnly&&taxSettings?.enabled?<a href={taxEditorBase+'/'+order.id}>ตรวจข้อมูลและออกใบกำกับภาษี</a>:<span className="muted">รอตั้งค่า VAT</span>}</td></tr>;
  })}</tbody></table></div>{!orders.length&&<p className="muted">ไม่พบออเดอร์</p>}</section>
 </>;
}
