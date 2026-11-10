import type {OrderIntake} from '@prisma/client';

type AddressOrder=Pick<OrderIntake,'address'|'createdAt'|'orderNumber'|'status'|'withdrawnAt'>;
export function customerAddress(address:string|null,orders:AddressOrder[]){
 if(address?.trim())return {address,source:'ทะเบียนลูกค้า'};
 const latest=orders.filter(order=>order.address?.trim()&&!order.withdrawnAt&&!['WITHDRAWN','CANCELLED'].includes(order.status))
  .sort((first,second)=>+second.createdAt-+first.createdAt)[0];
 return latest?{address:latest.address!,source:'ที่อยู่จัดส่งในออเดอร์ '+latest.orderNumber}:{address:null,source:null};
}
