import {syncStockReservation} from '@/lib/stock-flow';
import {after} from 'next/server';
import {processStockDispatch,processPendingStockDispatches} from '@/lib/stock-dispatch';
import {NextResponse} from "next/server";
import {admin,sameOrigin} from "@/lib/auth";
import {baseUrl} from "@/lib/config";
import {parseDispatchTime} from "@/lib/sales-dates";
import {updateShipmentFulfillment} from "@/lib/sales-recognition";
import {db} from '@/lib/db';
import {processStockReturn} from '@/lib/stock-return';
export const maxDuration=60;
export async function POST(req:Request){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return new Response("Forbidden",{status:403});}
 const f=await req.formData(),id=String(f.get("id")??""),action=String(f.get("action")??"");if(!["DISPATCHED","RETURNED","CANCELLED"].includes(action))return new Response("Invalid action",{status:400});
 try{await updateShipmentFulfillment(id,action as "DISPATCHED"|"RETURNED"|"CANCELLED",actor,String(f.get("evidence")??""),action==="DISPATCHED"?parseDispatchTime(String(f.get("dispatchedAt")??"")):undefined);
 let returning:string|undefined;
 if(action==='RETURNED'){
  const shipment=await db.shipment.findUniqueOrThrow({where:{orderId:id}});returning=shipment.tracking;
  await db.stockReturn.upsert({where:{tracking:returning},create:{tracking:returning,orderId:id,stage:'IN_TRANSIT',status:'NEEDS_REVIEW',reportedAt:new Date(),evidence:[{source:'manual',actor,reason:String(f.get('evidence')??'')}],issues:['รอยืนยันรับสินค้าคืนครบก่อนเพิ่มสต๊อก']},update:{}});
 }
 after(async()=>{if(action==='DISPATCHED')await processStockDispatch(id,actor).catch(()=>{});else if(returning)await processStockReturn(returning,actor).catch(()=>{});else await syncStockReservation(id).catch(()=>{});});return NextResponse.redirect(baseUrl()+"/admin/orders/"+encodeURIComponent(id)+"/review",303);}
 catch(e){const messages:Record<string,string>={DISPATCH_EVIDENCE_REQUIRED:"ระบุหลักฐานส่งมอบให้ขนส่งก่อน",INVALID_DISPATCH_TIME:"ระบุวันและเวลาจัดส่งจริงให้ถูกต้อง",ORDER_CLOSED:"ออเดอร์นี้ปิดแล้ว ไม่สามารถยืนยันส่งใหม่",SALE_CONFLICT:"ข้อมูลยอดขายขัดแย้ง ต้องตรวจสอบก่อน",SELLER_NOT_READY:"ข้อมูลผู้ขายยังไม่พร้อม",INVALID_SALES_AMOUNT:"ยังไม่มียอดขายที่ยืนยันได้"};return new Response(messages[e instanceof Error?e.message:""]??"บันทึกไม่ได้ กรุณาตรวจข้อมูลจัดส่งอีกครั้ง",{status:409});}
}
