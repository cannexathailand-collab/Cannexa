import {canonicalCustomerCode} from './customer-code';

export function customerUsername(value:unknown):string|null{
 if(typeof value!=='string')throw Error('กรุณากรอกชื่อผู้ใช้ให้ถูกต้อง');
 const name=value.normalize('NFKC').trim().toLowerCase();
 if(!name)return null;
 if(name.length<3||name.length>32||!/^[\p{L}\p{M}\p{N}._-]+$/u.test(name))throw Error('กรุณาตั้งชื่อผู้ใช้ 3–32 ตัว ใช้ตัวอักษร ตัวเลข จุด ขีดกลาง หรือขีดล่าง');
 if(name==='owner'||/^cus-/i.test(name)||/^CUS-\d{8}$/.test(canonicalCustomerCode(name)))throw Error('กรุณาเลือกชื่อผู้ใช้อื่น ชื่อนี้สงวนไว้สำหรับระบบ');
 return name;
}
