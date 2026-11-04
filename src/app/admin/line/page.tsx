import {requireAdminPage} from "@/lib/auth";
import {baseUrl,mockMode} from "@/lib/config";
import {lineSettings} from "@/lib/line-settings";

export default async function LinePage({searchParams}:{searchParams:Promise<{status?:string}>}){
 await requireAdminPage();
 const current=mockMode()?null:await lineSettings();
 const {status}=await searchParams;
 return <><h1>เชื่อมต่อ LINE</h1><div className="card">
 <p>{current?"บัญชีที่ตั้งค่าไว้ "+current.settings.basicId:"ยังไม่มีบัญชี LINE ที่ตั้งค่าไว้"}</p>
 {status==="saved"&&<p role="status">บันทึกแล้วและตรวจ Token ของ OA ผ่าน กรุณาทดสอบ LINE Login และ Verify Webhook ใน LINE Developers</p>}
 {status==="cleared"&&<p role="status">ล้างข้อมูลเชื่อมต่อแล้ว</p>}
 {status==="invalid"&&<p role="alert">บันทึกไม่ได้ กรุณาตรวจข้อมูลและ Access Token ของ OA</p>}
 <p>Callback URL <code>{baseUrl()}/api/line/callback</code></p>
 <p>Webhook URL <code>{baseUrl()}/api/line/webhook</code></p>
 <p>ผูก OA กับ LINE Login ใน Provider เดียวกันก่อนบันทึก เมื่อเปลี่ยน OA รายงานเดิมยังคงอยู่และนับรวมใน Dashboard</p>
 {mockMode()?<p>ใช้หน้านี้ในระบบจริงเพื่อเชื่อม LINE</p>:<form method="post" action="/api/admin/line">
 <label>LINE Login Channel ID<input name="loginId" required inputMode="numeric" maxLength={20}/></label>
 <label>LINE Login Channel Secret<input name="loginSecret" required type="password" maxLength={128} autoComplete="new-password"/></label>
 <label>Messaging API Channel Secret<input name="messagingSecret" required type="password" maxLength={128} autoComplete="new-password"/></label>
 <label>Messaging API Channel Access Token<input name="token" required type="password" maxLength={4096} autoComplete="new-password"/></label>
 <p>ระบบตรวจ Token กับ LINE ก่อนบันทึกและเข้ารหัสไว้</p>
 <button>ตรวจ Token และบันทึก</button>
 </form>}
 {current&&<form method="post" action="/api/admin/line"><input type="hidden" name="action" value="disconnect"/><p>การล้างจะหยุด LINE Login และ Webhook จนกว่าจะบันทึกข้อมูลใหม่</p><button className="secondary">ล้าง Token และยกเลิกการเชื่อมต่อ</button></form>}</div></>;
}
