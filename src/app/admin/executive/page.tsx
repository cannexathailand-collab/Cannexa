import {requireAdminPage} from '@/lib/auth';
import {executiveDashboard} from '@/lib/executive-dashboard';
import {ExecutiveDashboard} from '@/app/executive-dashboard';
export default async function ExecutivePage({searchParams}:{searchParams:Promise<{from?:string;to?:string;seller?:string}>}){
 await requireAdminPage([]);
 try{return <ExecutiveDashboard data={await executiveDashboard(await searchParams)}/>;}
 catch(error){if(error instanceof Error&&error.message.startsWith('INVALID'))return <section className="notice">เลือกช่วงวันที่ไม่เกิน 366 วัน และไม่เกินรอบปัจจุบัน <a href="/admin/executive">กลับช่วงเริ่มต้น</a></section>;throw error;}
}
