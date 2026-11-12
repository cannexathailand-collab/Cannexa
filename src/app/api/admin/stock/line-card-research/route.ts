import {admin,sameOrigin} from '@/lib/auth';
import {stockEditors} from '@/lib/accounts';
import {stockCode} from '@/lib/stock-code';
import {db} from '@/lib/db';
import {loadCustomerCatalog} from '@/lib/customer-catalog';
import {researchProduct} from '@/lib/product-research';
export const maxDuration=60;
export async function POST(request:Request){
 try{await admin(stockEditors);await sameOrigin();}catch{return Response.json({error:'ไม่มีสิทธิ์ค้นข้อมูลสินค้า'},{status:403});}
 try{
  const text=await request.text();if(text.length>1024)throw Error('INVALID_CODE');
  const code=stockCode.parse(JSON.parse(text).code),catalog=await loadCustomerCatalog(db,{merchandising:false});
  const product=catalog.products.find(p=>p.code===code);if(!product?.name)throw Error('PRODUCT_NOT_FOUND');
  return Response.json({code,...await researchProduct(product.name)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){const message=e instanceof Error?e.message:'';const messages:Record<string,string>={OPENAI_NOT_CONFIGURED:'กรุณาเชื่อม OpenAI ในหมวดการเชื่อมต่อก่อน',OPENAI_KEY_REJECTED:'คีย์ OpenAI ใช้งานไม่ได้ กรุณาเชื่อมใหม่',OPENAI_RATE_LIMIT:'OpenAI ยังรับคำขอไม่ได้ ตรวจยอดเครดิตหรือรอสักครู่',PRODUCT_NOT_FOUND:'ไม่พบชื่อสินค้านี้',RESEARCH_INVALID:'ผลค้นยังไม่ตรงรูปแบบ กรุณาตรวจสอบก่อนใช้งาน',RESEARCH_UNVERIFIED:'ยังยืนยันแหล่งข้อมูลไม่ได้ กรุณาตรวจสอบก่อนใช้งาน'};return Response.json({error:messages[message]??'ค้นข้อมูลไม่สำเร็จ กรุณาลองใหม่'},{status:message==='PRODUCT_NOT_FOUND'?404:503});}
}
