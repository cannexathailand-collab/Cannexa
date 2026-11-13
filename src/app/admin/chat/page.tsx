import {requireAdminPage} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {db} from '@/lib/db';
import {AdminChat} from '@/app/admin-chat';
export default async function ChatPage(){
 await requireAdminPage(approvers);
 const connection=await db.openAiConnection.findUnique({where:{id:'active'},select:{id:true}});
 return <><div className="intro"><div><div className="eyebrow">ผู้ช่วยหลังบ้าน</div><h1>Chat AI</h1><p className="muted">พิมพ์ถามข้อมูลจริงจากรายงานของร้าน</p></div></div><AdminChat ready={!!connection}/></>;
}
