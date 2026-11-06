import {db} from "./db";
import {normalizeName,normalizePhone,quotedTotal} from "./shipment-matching";
type Access={role:"owner"}|{role:"employee";username:string;affiliateId:string|null};
export async function orderReview(id:string,access:Access){
 if(access.role==="employee"&&!access.affiliateId)return null;
 const order=await db.orderIntake.findFirst({where:{id,status:{notIn:["WITHDRAWN","CANCELLED"]},...(access.role==="employee"?{sellerUsername:access.username,affiliateId:access.affiliateId}: {})}});
 if(!order)return null;
 const [sale,shipment]=await Promise.all([db.salesOrder.findUnique({where:{orderId:id}}),db.shipment.findUnique({where:{orderId:id}})]);
 const receipt=shipment?await db.codReceipt.findUnique({where:{tracking:shipment.tracking}}):null;
 const reasons=Array.isArray(order.issues)?order.issues.map(String):[];
 if(!order.affiliateId)reasons.push("ยังระบุผู้ขายที่ถูกต้องเพียงรายเดียวไม่ได้");
 if(!shipment)reasons.push("ยังไม่ผูกกับรายการจัดส่งที่ยืนยันได้");
 if(shipment&&shipment.fulfillmentStatus!=="DISPATCHED"&&!["RETURNED","CANCELLED"].includes(shipment.status))reasons.push("รอยืนยันอัตโนมัติจากรายงานจัดส่งที่จับคู่กับออเดอร์ หากจับคู่ไม่ได้ให้ตรวจข้อมูลผู้รับและเลขพัสดุ");
 if(order.payment==="COD"&&shipment&&order.status!=="RETURNED"){
  if(!receipt)reasons.push("ผูกจัดส่งแล้ว รอรายงานรับเงิน COD ของเลขพัสดุนี้ ไม่ได้หมายความว่าตีกลับ");
  else if(receipt.amountSatang!==shipment.codSatang)reasons.push("ยอดในรายงานรับเงิน COD ไม่ตรงกับยอดที่ระบุในรายการจัดส่ง");
 }
 if(order.payment==="เคลม"||sale?.status==="WAITING_COST")reasons.push("รอต้นทุนสินค้าจากระบบสต็อก");
 if(order.status==="RETURNED")reasons.push("พัสดุตีกลับ · ไม่นับยอดขายหรือค่าคอม · รอต้นทุนจากระบบสต็อก");
 const total=quotedTotal(order.rawText??"");
 const phone=normalizePhone(order.phone??"");
 const filters=[];
 if(phone)filters.push({phone:{in:[phone,"66"+phone.slice(1),"+66"+phone.slice(1)]}});
 if(order.payment==="COD"&&total!==null)filters.push({codSatang:total});
 const rows=access.role==="owner"&&!shipment&&filters.length?await db.shipment.findMany({where:{OR:filters},orderBy:{reportAt:"desc"},take:100}):[];
 const candidates=rows.filter(s=>(!!phone&&normalizePhone(s.phone)===phone)||(total!==null&&s.codSatang===total&&!!order.recipient&&normalizeName(s.recipient)===normalizeName(order.recipient))).slice(0,20);
 const candidateReceipts=candidates.length?await db.codReceipt.findMany({where:{tracking:{in:candidates.map(s=>s.tracking)}}}):[];
 const receiptByTracking=new Map(candidateReceipts.map(r=>[r.tracking,r]));
 if(candidates.length>1)reasons.push("พบพัสดุที่อาจเกี่ยวข้องหลายใบ ต้องตรวจให้ตรงออเดอร์ก่อนผูก");
 if(candidates.some(s=>s.orderId&&s.orderId!==order.id))reasons.push("มีพัสดุที่ผูกกับออเดอร์อื่นแล้ว ระบบจะไม่ผูกซ้ำ");
 if(candidates.some(s=>["RETURNED","CANCELLED"].includes(s.status)))reasons.push("พบประวัติพัสดุตีกลับหรือยกเลิก ต้องตรวจลำดับรายการส่ง");
 return {order,sale,shipment,receipt,reasons:[...new Set(reasons)],candidates:candidates.map(s=>({...s,receipt:receiptByTracking.get(s.tracking)??null})),canSeeCandidates:access.role==="owner"};
}
