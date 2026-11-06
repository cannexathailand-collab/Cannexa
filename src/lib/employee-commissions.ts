import {db} from './db';
import {mockMode} from './config';
export const commissionKinds={FRIEND:'ค่าคอมเพิ่มเพื่อน',TRANSFER:'ค่าคอมโอน',COD:'ค่าคอม COD',SPECIAL:'ค่าคอมพิเศษ / โบนัส'} as const;
export type EmployeeCommission={id:string;kind:keyof typeof commissionKinds;status:'PENDING'|'PAID'|'WAITING';amount:number|null;date:Date;paidAt:Date|null;reference:string;note:string};
export function summarizeEmployeeCommissions(rows:EmployeeCommission[]){
 const sum=(items:EmployeeCommission[],status:EmployeeCommission['status'])=>items.filter(r=>r.status===status).reduce((n,r)=>n+(r.amount??0),0);
 return {pending:sum(rows,'PENDING'),paid:sum(rows,'PAID'),waiting:rows.filter(r=>r.status==='WAITING').length,categories:Object.keys(commissionKinds).map(kind=>{const items=rows.filter(r=>r.kind===kind);return {kind:kind as keyof typeof commissionKinds,pending:sum(items,'PENDING'),paid:sum(items,'PAID'),waiting:items.filter(r=>r.status==='WAITING').length,count:items.length};})};
}
export async function employeeCommissions(affiliateId:string){
 const [friends,sales,extras,specials]=await Promise.all([
  db.commission.findMany({where:{conversion:{affiliateId,source:mockMode()?'MOCK':'LINE'},OR:[{status:'Approved',conversion:{status:'VERIFIED_NEW_FRIEND'}},{status:'Paid'},{status:'Pending'}]},include:{conversion:{select:{customerCode:true,verifiedAt:true,createdAt:true}}}}),
  db.salesOrder.findMany({where:{affiliateId,status:{not:'CANCELLED'}}}),
  db.additionalCommission.findMany({where:{affiliateId,status:{not:'CANCELLED'}}}),
  db.specialCommission.findMany({where:{affiliateId}})
 ]);
 const ids=[...new Set([...sales,...extras].map(r=>r.orderId))];
 const orders=await db.orderIntake.findMany({where:{OR:[{id:{in:ids}},{affiliateId},{commissionAffiliateId:affiliateId}]},select:{id:true,orderNumber:true,status:true,payment:true,createdAt:true}});
 const byId=new Map(orders.map(r=>[r.id,r]));
 const closed=(id:string)=>['CANCELLED','WITHDRAWN','RETURNED','EXPIRED'].includes(byId.get(id)?.status??'');
 const basis=(value:string,bps:number)=>(value==='REVENUE'?'ยอดขาย':value==='GROSS_PROFIT'?'กำไรหลังหักค่าขนส่ง':'กำไร')+' × '+(bps/100).toLocaleString('th-TH')+'%';
 const rows:EmployeeCommission[]=[
  ...friends.map(r=>({id:'friend:'+r.id,kind:'FRIEND' as const,status:r.status==='Paid'?'PAID' as const:r.status==='Approved'?'PENDING' as const:'WAITING' as const,amount:r.status==='Pending'?null:r.amountSatang,date:r.conversion.verifiedAt??r.conversion.createdAt,paidAt:r.paidAt,reference:r.conversion.customerCode,note:r.status==='Pending'?'รอตรวจสอบการเพิ่มเพื่อน':'เพิ่มเพื่อนผ่านการตรวจสอบ'})),
  ...sales.filter(r=>r.status==='PAID'||!closed(r.orderId)).map(r=>({id:'sale:'+r.id,kind:r.paymentMethod==='COD'?'COD' as const:'TRANSFER' as const,status:r.status==='PAID'?'PAID' as const:r.status==='PENDING'&&r.commissionSatang!==null?'PENDING' as const:'WAITING' as const,amount:r.status==='PAID'?(r.paidAmountSatang??r.commissionSatang??0):r.status==='PENDING'?r.commissionSatang:null,date:r.createdAt,paidAt:r.paidAt,reference:byId.get(r.orderId)?.orderNumber??'ออเดอร์',note:r.status==='WAITING_COD'?'รอรับเงินและจับคู่ COD':r.status==='WAITING_COST'?'รอต้นทุน / ค่าขนส่ง':basis(r.commissionBasis,r.commissionBps)})),
  ...extras.filter(r=>r.status==='PAID'||!closed(r.orderId)).map(r=>({id:'extra:'+r.id,kind:byId.get(r.orderId)?.payment==='โอน'?'TRANSFER' as const:'COD' as const,status:r.status==='PAID'?'PAID' as const:r.status==='PENDING'&&r.amountSatang!==null?'PENDING' as const:'WAITING' as const,amount:r.status==='PAID'?(r.paidAmountSatang??r.amountSatang??0):r.status==='PENDING'?r.amountSatang:null,date:r.createdAt,paidAt:r.paidAt,reference:byId.get(r.orderId)?.orderNumber??'ออเดอร์',note:'ผู้ปิดการขาย · '+(r.reversedAt?'จ่ายแล้ว มีรายการกลับบัญชี':r.status==='WAITING_SALE'?'รอยืนยันยอดขาย / รับเงิน':r.status==='WAITING_COST'?'รอต้นทุน / ค่าขนส่ง':basis(r.basis,r.bps))})),
  ...orders.filter(r=>!ids.includes(r.id)&&!closed(r.id)&&['COD','โอน'].includes(r.payment??'')).map(r=>({id:'waiting:'+r.id,kind:r.payment==='COD'?'COD' as const:'TRANSFER' as const,status:'WAITING' as const,amount:null,date:r.createdAt,paidAt:null,reference:r.orderNumber,note:r.status==='NEEDS_REVIEW'?'รอตรวจสอบข้อมูลออเดอร์':r.payment==='COD'?'รอจัดส่ง / จับคู่เงิน COD':'รอยืนยันยอดขาย'})),
  ...specials.map(r=>({id:'special:'+r.id,kind:'SPECIAL' as const,status:'PAID' as const,amount:r.amountSatang,date:r.paidAt,paidAt:r.paidAt,reference:'ค่าคอมพิเศษ',note:r.reason}))
 ];
 rows.sort((a,b)=>+b.date-+a.date||a.id.localeCompare(b.id));
 return {rows,...summarizeEmployeeCommissions(rows)};
}
