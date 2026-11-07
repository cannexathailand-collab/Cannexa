import {cookies} from "next/headers";
import {db} from "@/lib/db";
import {readToken} from "@/lib/crypto";
import {mockMode} from "@/lib/config";
import {lineSettings} from "@/lib/line-settings";
import {redirect} from "next/navigation";
import {lineCustomerDestination} from "@/lib/line-customer-destination";
export const dynamic="force-dynamic";
export default async function Result({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {error}=await searchParams;const s=readToken<{id:string;exp:number}>((await cookies()).get("customer_result")?.value??"");
 const c=!error&&s&&s.exp>Date.now()?await db.conversion.findUnique({where:{id:s.id}}):null;
 const mock=mockMode(),friend=c?.friendFlag===true;
 const basicId=!mock?(await lineSettings())?.settings.basicId:null;
 if(!mock){
  if(basicId&&/^@[\w.-]+$/.test(basicId))redirect(lineCustomerDestination(basicId,error?null:c?.friendFlag??null));
  redirect('/marketing/connect?error=unavailable');
 }
 return <main className="center-page"><div className="customer"><div className="check">{c?"✓":"!"}</div>
 {mock&&<div className="notice">MOCK · ไม่ใช่ผลจาก LINE จริง</div>}
 <h1>{!c?"ยังทำรายการไม่สำเร็จ":friend?"บันทึกการเชื่อมต่อเรียบร้อย":"บันทึกผล Login แล้ว"}</h1>
 {mock&&c&&<section><p>รหัสลูกค้าของคุณ</p><p><strong style={{fontSize:24}}>{c.customerCode}</strong></p><p className="small">เก็บรหัสนี้ไว้แจ้งพนักงานเมื่อสั่งซื้อ ใช้รหัสเดิมได้ทุกครั้ง</p></section>}
 <p className="muted">{!c?"กรุณาสแกน QR บนคูปองเพื่อลองใหม่":friend?"ขอบคุณที่ร่วมกิจกรรม ผลการแนะนำจะผ่านการตรวจสอบอีกครั้ง":"ยังยืนยันสถานะเพื่อนไม่ได้ กรุณาสแกนคูปองอีกครั้ง หรือเปิด LINE OA"}</p>
 {c&&<p className="small">สถานะการตรวจสอบ: {c.status}</p>}
 {!mock&&basicId&&<a className="button" href={"https://line.me/R/oaMessage/"+encodeURIComponent(basicId)}>เปิดแชท LINE OA</a>}
 <p className="small muted"><a href="/privacy">นโยบายความเป็นส่วนตัว</a></p></div></main>;
}
