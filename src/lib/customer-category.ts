export const customerCategories={GENERAL:'ลูกค้าทั่วไป',SHOP:'ลูกค้าร้านค้า'} as const;
export function customerCategory(value:unknown){
 if(value===undefined)return undefined;
 if(value==='GENERAL'||value==='SHOP')return value;
 throw Error('กรุณาเลือกประเภทลูกค้า');
}
export function customerLicenseNumber(category:string|undefined,value:unknown){
 if(category===undefined)return undefined;
 if(category!=='SHOP')return null;
 if(typeof value!=='string'||!value.trim()||value.trim().length>100)throw Error('กรุณากรอกเลขที่ใบอนุญาต ไม่เกิน 100 ตัวอักษร');
 return value.trim();
}
