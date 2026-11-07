import {requireAdminPage} from '@/lib/auth';
import {managers} from '@/lib/accounts';
import {baseUrl} from '@/lib/config';
import {CustomerEntryLinks} from './customer-entry-links';
import {marketingReport} from '@/lib/marketing-report';
import {MarketingSummary} from './marketing-summary';
import './customer-entry.css';

export default async function CustomerEntryPage({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}){
 await requireAdminPage(managers);
 let report,invalidRange=false;
 try{report=await marketingReport(await searchParams);}
 catch(error){if(!(error instanceof Error)||error.message!=='INVALID_DATE_RANGE')throw error;report=await marketingReport();invalidRange=true;}
 return <>
  <h1>ลูกค้า</h1>
  <p>ลิงก์เข้าสู่หน้า Customer สำหรับส่งให้ลูกค้า</p>
  <CustomerEntryLinks baseUrl={baseUrl()}/>
  {invalidRange&&<p role="alert" className="notice">ช่วงวันที่ไม่ถูกต้อง กำลังแสดงข้อมูลวันนี้</p>}
  <MarketingSummary report={report}/>
 </>;
}
