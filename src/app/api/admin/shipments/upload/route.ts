import {stockEditors} from '@/lib/accounts';
import {admin,sameOrigin} from '@/lib/auth';
import {uploadShipmentFile} from '@/lib/upload-shipment-file';
export const maxDuration=60;
export async function POST(request:Request){
 let actor:string;try{actor=await admin(stockEditors);await sameOrigin();}catch{return Response.json({error:'ไม่มีสิทธิ์อัปโหลดรายการจัดส่ง'},{status:403});}
 return uploadShipmentFile(request,actor);
}
