export function needsOrderReview(order:{status:string;payment:string|null},sale?:{status:string}|null,tracking?:string|null){
 if(["RETURNED","CANCELLED","WITHDRAWN","EXPIRED"].includes(order.status))return false;
 return ["NEEDS_REVIEW","WAITING_SHIPMENT","MATCHED_SHIPMENT_WAITING_COD","COD_AMOUNT_MISMATCH","CLAIM_WAITING_COST"].includes(order.status)||sale?.status==="WAITING_COST"||(order.status==="TRANSFER_RECORDED"&&!tracking);
}
