type Order={payment:string|null;status:string;withdrawnAt:Date|null};
type Shipment={codSatang:number;status:string;fulfillmentStatus:string};
export function receiptPaymentAmount(order:Order,transferAmount:number|null,shipment:Shipment|null,codAmount:number|null){
 if(order.withdrawnAt||['CANCELLED','WITHDRAWN','EXPIRED','RETURNED','REJECTED'].includes(order.status))return null;
 if(shipment&&(['CANCELLED','RETURNED','WITHDRAWN'].includes(shipment.status)||['CANCELLED','RETURNED'].includes(shipment.fulfillmentStatus)))return null;
 const amount=order.payment==='โอน'?transferAmount:order.payment==='COD'&&shipment&&codAmount===shipment.codSatang?codAmount:null;
 return amount!==null&&Number.isSafeInteger(amount)&&amount>0?amount:null;
}
