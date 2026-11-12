import {admin,sameOrigin} from '@/lib/auth';
import {stockEditors} from '@/lib/accounts';
import {db} from '@/lib/db';
import {createOaJob,publicOaJob} from '@/lib/line-oa-job';
export async function GET(){
 try{await admin(stockEditors);}catch{return new Response('Forbidden',{status:403});}
 const jobs=await db.lineOaJob.findMany({orderBy:{createdAt:'desc'},take:10});return Response.json(jobs.map(publicOaJob),{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 let actor:string;try{actor=await admin(stockEditors);await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 try{const body=await request.text();if(body.length>10000)throw Error('INVALID_INPUT');return Response.json(await createOaJob(actor,JSON.parse(body)));}
 catch(e){const code=e instanceof Error?e.message:'';const messages:Record<string,string>={OA_NOT_CONNECTED:'กรุณาเชื่อม LINE ก่อน',OA_BROWSER_NOT_CONFIGURED:'กรุณาเชื่อม LINE OA บนเซิร์ฟเวอร์ในหมวดการเชื่อมต่อก่อน',OPENAI_NOT_CONFIGURED:'กรุณาเชื่อม OpenAI ก่อน',OA_ACCOUNT_MISMATCH:'บัญชี LINE OA บนเซิร์ฟเวอร์ไม่ตรงกับร้าน',OA_IMAGES_MISSING:'สินค้าต้องมีรูปหลักและรูปเสริมสองรูปครบก่อนสร้างการ์ด',OA_JOB_ALREADY_PENDING:'มีงานของสินค้าที่เลือกกำลังรออยู่ กรุณาดูสถานะงานเดิม',PRODUCT_NOT_FOUND:'มีสินค้าที่ไม่พบในรายการล่าสุด'};return Response.json({error:messages[code]??'ข้อมูลไม่ครบหรือรหัสสินค้ายาวเกินข้อจำกัดแท็กของ LINE OA (12 ตัวอักษร)'},{status:409});}
}
