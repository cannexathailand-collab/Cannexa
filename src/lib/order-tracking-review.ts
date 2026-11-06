export const TRACKING_REVIEW_DAYS=3;
export const COD_REVIEW_DAYS=10;
export function needsTrackingReview(order:{status:string;createdAt?:Date},tracking?:string|null,now=new Date()){
 if(['RETURNED','CANCELLED','WITHDRAWN','EXPIRED'].includes(order.status)||tracking?.trim()||!order.createdAt)return false;
 return Number.isFinite(+order.createdAt)&&+now-+order.createdAt>TRACKING_REVIEW_DAYS*86400000;
}
export function needsCodReceiptReview(order:{status:string;payment:string|null},shipment:{tracking?:string;codSatang?:number;fulfillmentStatus:string;dispatchedAt:Date|null}|null|undefined,receipt:{tracking:string;amountSatang:number}|null|undefined,now=new Date()){
 if(order.payment!=='COD'||['RETURNED','CANCELLED','WITHDRAWN','EXPIRED'].includes(order.status)||shipment?.fulfillmentStatus!=='DISPATCHED'||!shipment.dispatchedAt)return false;
 if(receipt&&receipt.tracking===shipment.tracking&&shipment.codSatang!==undefined&&shipment.codSatang>0&&receipt.amountSatang===shipment.codSatang)return false;
 return Number.isFinite(+shipment.dispatchedAt)&&+now-+shipment.dispatchedAt>=COD_REVIEW_DAYS*86400000;
}
