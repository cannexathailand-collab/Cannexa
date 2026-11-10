import {db} from '@/lib/db';
import {managers} from '@/lib/accounts';
import {requireAdminPage} from '@/lib/auth';
import {defaultTierSettings} from '@/lib/crm-tiers';
import {CrmTierSettings} from '@/app/crm-tier-settings';
import Link from 'next/link';

export default async function CrmTiers({searchParams}:{searchParams:Promise<{saved?:string;tier?:string}>}){
 const actor=await requireAdminPage(managers);
 const settings=await db.crmTierSettings.findUnique({where:{id:'default'}})??defaultTierSettings;
 const p=await searchParams;
 return <><h1>Member และเกณฑ์จัดกลุ่ม</h1><p>ตั้งค่า Member ของลูกค้าใน CRM</p><div className="filters"><Link className="button" href="/admin/crm/create">สมัครสมาชิกให้ลูกค้า</Link><Link className="button secondary" href="/admin/crm">จัดการระดับสมาชิกรายคน</Link></div>{p.saved==='1'&&<p className="notice live">บันทึกเกณฑ์ Member แล้ว</p>}<CrmTierSettings settings={settings} editable={['owner','admin'].includes(actor.role)} activeTier={p.tier} key={JSON.stringify(settings)}/></>;
}
