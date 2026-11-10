import Link from 'next/link';
import {requireAdminPage} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {bookedSalesReport} from '@/lib/booked-sales';
import type {SalesFilters} from '@/lib/sales-report';
import {DailyProfitLedger} from '@/app/daily-profit-ledger';

export default async function ProfitLedger({searchParams}:{searchParams:Promise<SalesFilters&{ledgerMonth?:string;ledgerDay?:string}>}){
 await requireAdminPage(approvers);
 const filters=await searchParams;
 let data;try{data=await bookedSalesReport(filters)}catch(error){if(error instanceof Error&&error.message.startsWith('INVALID'))return <p className="notice">ช่วงวันที่ไม่ถูกต้อง <Link href="/admin/sales/profit">กลับบัญชีกำไรรายวัน</Link></p>;throw error;}
 const backQuery=new URLSearchParams({from:data.range.from,to:data.range.to,payment:data.payment,seller:data.seller,...(filters.demo==='1'?{demo:'1'}:{})});
 return <><header className="intro"><div><h1>บัญชีกำไรรายวัน</h1><p>เลือกวันปิดรอบเพื่อดูรายละเอียดกำไร · ตัดรอบเวลา {data.closeTime} น.</p><p className="muted small">ผู้ขาย {data.seller||'ทั้งหมด'} · ประเภท {data.payment==='COD'?'COD':data.payment==='TRANSFER'?'โอน':'ทั้งหมด'}</p></div><Link className="button secondary" href={'/admin/sales?'+backQuery}>กลับยอดขาย</Link></header>{filters.demo==='1'&&<p className="notice">ข้อมูลจำลองสำหรับทดสอบ</p>}<DailyProfitLedger rows={data.profitHistory} initialMonth={filters.ledgerMonth??data.range.from.slice(0,7)} initialDay={filters.ledgerDay} from={data.range.from} to={data.range.to} action="/admin/sales" payment={data.payment} seller={data.seller} demo={filters.demo==='1'}/></>;
}
