import {requireAdminPage} from '@/lib/auth';
import {managers} from '@/lib/accounts';
import {baseUrl} from '@/lib/config';
import {CustomerEntryLinks} from './customer-entry-links';
import './customer-entry.css';

export default async function CustomerEntryPage(){
 await requireAdminPage(managers);
 return <>
  <h1>ลูกค้า</h1>
  <p>ลิงก์เข้าสู่หน้า Customer สำหรับส่งให้ลูกค้า</p>
  <CustomerEntryLinks baseUrl={baseUrl()}/>
 </>;
}
