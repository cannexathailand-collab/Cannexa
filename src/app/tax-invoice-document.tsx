import type {CustomerTaxInvoice} from '@prisma/client';
import {taxInvoiceSnapshotSchema} from '@/lib/tax-invoices';
import {DocumentBrandHeader} from './document-brand-header';
import {ReceiptActions} from './receipts/[id]/receipt-actions';
import './receipts/[id]/receipt.css';

export function TaxInvoiceDocument({invoice,back}:{invoice:CustomerTaxInvoice;back:string}){
 const data=taxInvoiceSnapshotSchema.parse(invoice.snapshot);
 const money=(value:number)=>(value/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
 const date=invoice.issuedAt.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'});
 const branch=(value:string)=>value==='00000'?'สำนักงานใหญ่':'สาขา '+value;
 const text=['ใบกำกับภาษี / TAX INVOICE',invoice.number,date,data.branding.name,data.issuer.name,data.issuer.address,'เลขผู้เสียภาษี '+data.issuer.taxId,branch(data.issuer.branchCode),'ผู้ซื้อ '+data.buyer.name,data.buyer.address,data.buyer.taxId&&'เลขผู้เสียภาษี '+data.buyer.taxId,branch(data.buyer.branchCode),...data.lines.map(line=>line.description+' × '+line.quantity+' | '+money(line.grossSatang)), 'มูลค่าก่อน VAT '+money(invoice.netSatang),'VAT '+money(invoice.vatSatang),'รวม '+money(invoice.totalSatang)+' บาท',data.branding.footer].filter(Boolean).join('\n');
 return <main className="receipt-page" lang="th">
  <div className="receipt-toolbar"><a href={back}>กลับ</a><ReceiptActions text={text} english={false} documentType="tax-invoice"/></div>
  <article className="receipt-paper"><DocumentBrandHeader brand={data.branding}/>
   <header><div><h1>ใบกำกับภาษี</h1><p>TAX INVOICE</p><p>{invoice.number}</p><p>วันที่ {date}</p></div><div><strong>{data.issuer.name}</strong><p>{data.issuer.address}</p><p>เลขประจำตัวผู้เสียภาษี {data.issuer.taxId}</p><p>{branch(data.issuer.branchCode)}</p><p>{data.issuer.phone}</p></div></header>
   <section className="receipt-parties"><div><h2>ผู้ซื้อ</h2><strong>{data.buyer.name}</strong><p>{data.buyer.address}</p>{data.buyer.taxId&&<p>เลขประจำตัวผู้เสียภาษี {data.buyer.taxId}</p>}<p>{branch(data.buyer.branchCode)}</p></div><div><p>ออเดอร์ {data.orderNumber}</p><p>สกุลเงิน THB</p></div></section>
   <div className="table-wrap"><table><thead><tr><th>รายการ</th><th>จำนวน</th><th>ก่อน VAT</th><th>VAT</th><th>รวม</th></tr></thead><tbody>{data.lines.map((line,index)=><tr key={index}><td>{line.description}<br/><small>{line.treatment==='EXEMPT'?'ยกเว้น VAT':'VAT '+(line.treatment==='ZERO'?0:data.vatRateBps/100)+'%'}</small></td><td>{line.quantity}</td><td>{money(line.netSatang)}</td><td>{money(line.vatSatang)}</td><td>{money(line.grossSatang)}</td></tr>)}</tbody></table></div>
   <p>มูลค่าก่อน VAT {money(invoice.netSatang)} บาท</p><p>ภาษีมูลค่าเพิ่ม {money(invoice.vatSatang)} บาท</p><div className="receipt-total"><span>รวมทั้งสิ้น (บาท)</span><strong>{money(invoice.totalSatang)}</strong></div>
   {data.branding.footer&&<footer>{data.branding.footer}</footer>}
  </article>
 </main>;
}

