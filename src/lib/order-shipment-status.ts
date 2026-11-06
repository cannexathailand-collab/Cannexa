export function orderShipmentStatus(status:string,tracking?:string,fulfillmentStatus?:string,dispatchedAt?:Date|null){
 if(status==='RETURNED'||fulfillmentStatus==='RETURNED')return {label:'พัสดุตีกลับ',matched:!!tracking};
 if(['WITHDRAWN','CANCELLED'].includes(status)||fulfillmentStatus==='CANCELLED')return {label:'ยกเลิก',matched:!!tracking};
 if(!tracking?.trim())return {label:'ยังไม่จับคู่',matched:false};
 return {label:fulfillmentStatus==='DISPATCHED'&&dispatchedAt?'จับคู่สำเร็จ · จัดส่งแล้ว':'จับคู่สำเร็จ',matched:true};
}
