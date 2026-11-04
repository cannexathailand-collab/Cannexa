import {requireAdminPage} from "@/lib/auth";
import {db} from "@/lib/db";
export default async function Audit(){await requireAdminPage();const logs=await db.auditLog.findMany({take:200,orderBy:{createdAt:"desc"}});return <><h1>ประวัติการดำเนินการ</h1><p className="muted">200 รายการล่าสุด · บันทึกการแก้ไขและตัดสินใจ</p>{logs.map(l=><details className="card" key={l.id}><summary>{l.action} · {l.actor} · {l.createdAt.toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}</summary><code>{l.entityId}</code><pre style={{whiteSpace:"pre-wrap"}}>{JSON.stringify(l.details,null,2)}</pre></details>)}</>;}
