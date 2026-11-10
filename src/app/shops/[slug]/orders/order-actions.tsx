import {randomUUID} from 'node:crypto';
import type {OrderIntake} from '@prisma/client';
import {orderEditVersion} from '@/lib/order-changes';
import {isEmployeeRole} from '@/lib/accounts';
import {shopPath} from '@/lib/shop-session';
export function ShopOrderActions({slug,role,order}:{slug:string;role:string;order:OrderIntake}){
 if(['CANCELLED','WITHDRAWN','EXPIRED','RETURNED'].includes(order.status))return null;
 const action=shopPath(slug)+'/orders/change',version=orderEditVersion(order);
 return <div className="actions">{role==='owner'&&<details><summary>แก้ไขออเดอร์</summary><form action={action} method="post"><input type="hidden" name="action" value="EDIT"/><input type="hidden" name="id" value={order.id}/><input type="hidden" name="requestKey" value={randomUUID()}/><input type="hidden" name="expectedVersion" value={version}/><label>ข้อความออเดอร์<textarea name="text" defaultValue={order.rawText??''} required maxLength={12000} rows={12}/></label><p>แก้ชื่อผู้รับ ที่อยู่ โทรศัพท์ สินค้า และยอดเงินก่อนจัดส่งได้</p><button>บันทึกการแก้ไข</button></form></details>}{(role==='owner'||isEmployeeRole(role))&&<details><summary>ยกเลิกออเดอร์</summary><form action={action} method="post"><input type="hidden" name="action" value="CANCEL"/><input type="hidden" name="id" value={order.id}/><input type="hidden" name="requestKey" value={randomUUID()}/><input type="hidden" name="expectedVersion" value={version}/><label>เหตุผล<input name="reason" required maxLength={500}/></label><label><input type="checkbox" name="confirm" value="yes" required/> ยืนยันยกเลิกออเดอร์นี้</label><button>ยกเลิกออเดอร์</button></form></details>}</div>;
}
