export const TRACKING_REVIEW_DAYS=3;
export const COD_REVIEW_DAYS=10;
export const DISPATCH_REVIEW_DAYS=3;
export const dispatchReviewReason='มีเลขพัสดุเกิน 3 วัน แต่ยังไม่มีรายงานยืนยันการจัดส่งจริง';
export function needsDispatchConfirmationReview(order:{status:string;createdAt?:Date},shipment:{tracking?:string;status?:string;fulfillmentStatus:string;dispatchedAt:Date|null;createdAt?:Date}|null|undefined,reportVerified:boolean,now=new Date()){
 if(['RETURNED','CANCELLED','WITHDRAWN','EXPIRED'].includes(order.status)||!shipment?.tracking?.trim()||['RETURNED','CANCELLED','WITHDRAWN'].includes(shipment.status??'')||['RETURNED','CANCELLED'].includes(shipment.fulfillmentStatus))return false;
 if(reportVerified&&shipment.fulfillmentStatus==='DISPATCHED'&&shipment.dispatchedAt)return false;
 const timestamps=[order.createdAt,shipment.createdAt].flatMap(value=>value&&Number.isFinite(+value)?[+value]:[]);
 if(!timestamps.length)return false;
 return +now-Math.max(...timestamps)>DISPATCH_REVIEW_DAYS*86400000;
}
export function needsTrackingReview(order:{status:string;createdAt?:Date},tracking?:string|null,now=new Date()){
 if(['RETURNED','CANCELLED','WITHDRAWN','EXPIRED'].includes(order.status)||tracking?.trim()||!order.createdAt)return false;
 return Number.isFinite(+order.createdAt)&&+now-+order.createdAt>TRACKING_REVIEW_DAYS*86400000;
}
export function needsCodReceiptReview(order:{status:string;payment:string|null},shipment:{tracking?:string;codSatang?:number;fulfillmentStatus:string;dispatchedAt:Date|null}|null|undefined,receipt:{tracking:string;amountSatang:number}|null|undefined,now=new Date(),reportVerified=true){
 if(!reportVerified||order.payment!=='COD'||['RETURNED','CANCELLED','WITHDRAWN','EXPIRED'].includes(order.status)||shipment?.fulfillmentStatus!=='DISPATCHED'||!shipment.dispatchedAt)return false;
 if(receipt&&receipt.tracking===shipment.tracking&&shipment.codSatang!==undefined&&shipment.codSatang>0&&receipt.amountSatang===shipment.codSatang)return false;
 return Number.isFinite(+shipment.dispatchedAt)&&+now-+shipment.dispatchedAt>=COD_REVIEW_DAYS*86400000;
}
