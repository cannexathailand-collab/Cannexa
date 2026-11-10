import type {CustomerReceipt} from '@prisma/client';
import {receiptSnapshotSchema} from '@/lib/customer-receipts';
import {thaiBahtText} from '@/lib/receipt-document-values';
import {ReceiptActions} from './receipts/[id]/receipt-actions';
import './receipts/[id]/receipt.css';

export function ReceiptDocument({receipt,english=false,back}:{receipt:CustomerReceipt;english?:boolean;back:string}){
 const data=receiptSnapshotSchema.parse(receipt.snapshot);
 const money=(value:number)=>(value/100).toLocaleString(english?'en-US':'th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
 const amount=money(receipt.amountSatang);
 const date=receipt.issuedAt.toLocaleDateString(english?'en-GB':'th-TH',{timeZone:'Asia/Bangkok'});
 const payment=data.payment==='COD'?'COD':english?'Bank transfer':'โอนเงิน';
 const title=english?'RECEIPT':'ใบเสร็จรับเงิน';
 const copied=[data.branding?.name,title,receipt.number,date,data.issuer.name,data.issuer.address,data.issuer.taxId&&'ID '+data.issuer.taxId,data.issuer.phone,data.customer.name,data.customer.address,data.orderNumber,...data.items.map(item=>item.description+' × '+item.quantity+(item.totalSatang===undefined?'':' = '+money(item.totalSatang)+' THB')),(english?'Total received ':'รับเงินรวม ')+amount+' THB',payment,data.branding?.footer].filter(Boolean).join('\n');
 return <main className="receipt-page receipt-form-page" lang={english?'en':'th'}>
  <div className="receipt-toolbar"><a href={back}>{english?'Back':'กลับ'}</a><ReceiptActions text={copied} english={english}/></div>
  <article className="receipt-paper receipt-form">
   <header className="receipt-form-heading">
    <div className="receipt-form-title">
     {data.branding?.logoPath&&<img className="receipt-form-logo" src={data.branding.logoPath} alt={data.branding.name||'Store logo'}/>}
     <div><div className="receipt-form-kicker">RECEIPT</div><h1>{title}</h1>{data.branding?.name&&<p className="receipt-form-brand">{data.branding.name}</p>}</div>
    </div>
    <dl className="receipt-identifiers"><dt>{english?'Document no.':'เลขที่เอกสาร'}</dt><dd>{receipt.number}</dd><dt>{english?'Date':'วันที่'}</dt><dd>{date}</dd></dl>
   </header>
   <section className="receipt-form-parties">
    <div><h2>{english?'Issued by':'ผู้ออกเอกสาร'}</h2><strong>{data.issuer.name}</strong><p>{data.issuer.address}</p>{data.issuer.taxId&&<p>{english?'Tax ID':'เลขประจำตัวผู้เสียภาษี'} {data.issuer.taxId}</p>}{data.issuer.phone&&<p>{english?'Tel.':'โทร.'} {data.issuer.phone}</p>}</div>
    <div><h2>{english?'Customer':'ลูกค้า'}</h2><strong>{data.customer.name}</strong><p>{data.customer.address||'—'}</p>{data.customer.code&&<p>{english?'Customer code':'รหัสลูกค้า'} {data.customer.code}</p>}<p>{english?'Order':'ออเดอร์'} {data.orderNumber}</p></div>
   </section>
   <div className="receipt-form-table-wrap"><table className="receipt-form-items">
    <colgroup><col className="receipt-col-number"/><col/><col className="receipt-col-quantity"/><col className="receipt-col-price"/><col className="receipt-col-total"/></colgroup>
    <thead><tr><th>{english?'No.':'ลำดับ'}</th><th>{english?'Description':'รายการ'}</th><th>{english?'Quantity':'จำนวน'}</th><th>{english?'Unit price':'ราคา/หน่วย'}</th><th>{english?'Amount':'รวม'}</th></tr></thead>
    <tbody>{data.items.map((item,index)=><tr key={index}><td>{index+1}</td><td>{item.description}</td><td>{item.quantity}</td><td>{item.unitPriceSatang===undefined?'—':money(item.unitPriceSatang)}</td><td>{item.totalSatang===undefined?'—':money(item.totalSatang)}</td></tr>)}{data.items.length<4&&<tr className="receipt-form-filler" aria-hidden="true"><td>&nbsp;</td><td/><td/><td/><td/></tr>}</tbody>
   </table></div>
   <section className="receipt-form-settlement">
    <div className="receipt-form-notes"><div><h2>{english?'Notes':'หมายเหตุ'}</h2><p>{data.branding?.footer||'—'}</p>{data.items.some(item=>item.totalSatang===undefined)&&<p className="receipt-price-note">{english?'Item prices were not recorded in the original receipt.':'เอกสารเดิมไม่ได้บันทึกราคาแยกรายการ'}</p>}</div><p className="receipt-amount-words">{english?amount+' Thai baht':thaiBahtText(receipt.amountSatang)}</p></div>
    <dl className="receipt-form-totals"><div><dt>{english?'Total amount':'รวมเป็นเงิน'}</dt><dd>{amount}</dd></div><div className="receipt-form-grand-total"><dt>{english?'Total received':'จำนวนเงินที่รับทั้งสิ้น'}</dt><dd>{amount}</dd></div></dl>
   </section>
   <section className="receipt-form-payment">
    <h2>{english?'Payment':'การชำระเงิน'}</h2>
    <div className="receipt-payment-methods"><span><span aria-hidden="true">□</span> {english?'Cash':'เงินสด'}</span><span><span aria-hidden="true">{data.payment==='TRANSFER'?'☑':'□'}</span> {english?'Bank transfer':'โอนเงิน'}</span><span><span aria-hidden="true">{data.payment==='COD'?'☑':'□'}</span> {english?'Cash on delivery':'เก็บเงินปลายทาง (COD)'}</span></div>
    <div className="receipt-payment-notes"><h2>{english?'Payment details':'รายละเอียดการรับเงิน'}</h2><p>{english?'Received on':'รับเงินตามเอกสารวันที่'} {date} · {english?'Amount':'ยอดรับเงิน'} {amount} {english?'THB':'บาท'}</p></div>
   </section>
   <section className="receipt-form-signatures" aria-label={english?'Signatures':'ลายมือชื่อ'}>{[english?'Authorized by':'อนุมัติโดย',english?'Received by':'ผู้รับเงิน'].map(label=><div key={label}><p>{label}</p><div className="receipt-signature-line"/><p>(............................)</p><p>{english?'Date':'วันที่'} ........../........../..........</p></div>)}</section>
  </article>
 </main>;
}
