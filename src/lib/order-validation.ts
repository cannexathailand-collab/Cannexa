import {hasCompletePostalCode} from './order-draft';
import {validContactPhones} from './contact-phones';

export function orderRejectionReasons(order:{customerCode?:string|null;address?:string|null;phone?:string|null}){
 const reasons:string[]=[];
 if(!order.customerCode?.trim())reasons.push('ไม่มีรหัสลูกค้า');
 if(!order.address||!hasCompletePostalCode(order.address))reasons.push('รหัสไปรษณีย์ไม่ครบ 5 หลัก');
 if(!validContactPhones(order.phone??''))reasons.push('เบอร์โทรไม่ครบ 10 หลัก');
 return reasons;
}
export function orderRejectionText(reasons:string[]){
 return 'บันทึกไม่สำเร็จ: '+reasons.join(' · ')+'\nกรุณาแก้ไขข้อมูลแล้วส่งออเดอร์ใหม่';
}
