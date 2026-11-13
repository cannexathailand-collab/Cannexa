import {admin,currentAccount,sameOrigin} from '@/lib/auth';
import {stockEditors} from '@/lib/accounts';
import {db} from '@/lib/db';
import {createOaJob,publicOaJob,oaPayload} from '@/lib/line-oa-job';
export async function GET(){
 try{await admin(stockEditors);}catch{return new Response('Forbidden',{status:403});}
 const actor=await currentAccount();
 const connection=actor.role==='owner'?null:await db.lineOaBrowser.findUnique({where:{id:'active'},select:{account:true}});
 const visible=actor.role==='owner'?{}:{account:connection?.account??''};
 const newest=await db.lineOaJob.findFirst({where:visible,orderBy:{createdAt:'desc'}});
 const parsed=oaPayload.safeParse(newest?.payload),batchKey=parsed.success?parsed.data.batchKey:undefined;
 const jobs=!newest?[]:batchKey?await db.lineOaJob.findMany({where:{...visible,payload:{path:['batchKey'],equals:batchKey}},orderBy:{createdAt:'asc'},take:50}):[newest];
 const accounts=await db.lineOaAccount.findMany({where:{account:{in:jobs.map(job=>job.account)}}});
 return Response.json(jobs.map(job=>({...publicOaJob(job),accountName:accounts.find(account=>account.account===job.account)?.name??job.account})),{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 let actor:string;try{actor=await admin(stockEditors);await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 try{const body=await request.text();if(body.length>512000)throw Error('INVALID_INPUT');return Response.json(await createOaJob(actor,JSON.parse(body),(await currentAccount()).role==='owner'));}
 catch(e){const code=e instanceof Error?e.message:'';const messages:Record<string,string>={OA_PREVIEW_EXPIRED:'ข้อมูลตัวอย่างหมดอายุ กรุณาค้นหาใหม่',OA_PREVIEW_CHANGED:'สินค้า รูป หรือบริบทเปลี่ยนแล้ว กรุณาเตรียมตัวอย่างใหม่',OA_PREVIEW_UNVERIFIED:'ยังไม่มีแหล่งอ้างอิงที่ยืนยันได้ กรุณาค้นหาใหม่',OA_TARGET_FORBIDDEN:'ไม่มีสิทธิ์สร้างงานไปยัง OA นี้',OA_TARGET_UNAVAILABLE:'OA ที่เลือกไม่อยู่ในรายชื่อที่เชื่อมไว้ กรุณาโหลดรายชื่อใหม่',OA_REQUEST_CHANGED:'คำขอเดิมใช้กับสินค้าและ OA เดิมเท่านั้น กรุณาสร้างคำขอใหม่',OA_NOT_CONNECTED:'กรุณาเชื่อม LINE ก่อน',OA_BROWSER_NOT_CONFIGURED:'กรุณาเชื่อม LINE OA บนเซิร์ฟเวอร์ในหมวดการเชื่อมต่อก่อน',OPENAI_NOT_CONFIGURED:'กรุณาเชื่อม OpenAI ก่อน',OA_ACCOUNT_MISMATCH:'บัญชี LINE OA บนเซิร์ฟเวอร์ไม่ตรงกับร้าน',OA_IMAGES_MISSING:'สินค้าต้องมีรูปหลักและรูปเสริมสองรูปครบก่อนสร้างการ์ด',OA_JOB_ALREADY_PENDING:'มีงานของสินค้าที่เลือกกำลังรออยู่ใน OA นี้ กรุณาดูสถานะงานเดิม',PRODUCT_NOT_FOUND:'มีสินค้าที่ไม่พบในรายการล่าสุด'};return Response.json({error:messages[code]??'ข้อมูลไม่ครบหรือรหัสสินค้ายาวเกินข้อจำกัดแท็กของ LINE OA (12 ตัวอักษร)'},{status:409});}
}
