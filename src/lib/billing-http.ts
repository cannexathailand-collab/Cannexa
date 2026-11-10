import {saveDocumentBranding} from './document-branding';
import {saveTaxInvoiceSettings,issueTaxInvoice} from './tax-invoices';
export async function billingMutationResponse(request:Request,actor:string,kind:'branding'|'tax-settings'|'tax-invoice'){
 try{
  const text=await request.text();if(text.length>2850000)throw Error('TOO_LARGE');
  const input=JSON.parse(text);
  const result=kind==='branding'?await saveDocumentBranding(actor,input):kind==='tax-settings'?await saveTaxInvoiceSettings(actor,input):await issueTaxInvoice(actor,input);
  return Response.json({ok:true,id:'id' in result?result.id:undefined},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){
  const messages:Record<string,string>={VAT_ISSUER_REQUIRED:'กรุณาตั้งข้อมูลร้านตามทะเบียน VAT พร้อมเลขผู้เสียภาษีที่ถูกต้องก่อน',INVALID_VAT_REGISTRATION_DATE:'วันที่จดทะเบียน VAT ต้องไม่เป็นวันในอนาคต',TAX_ORDER_BEFORE_REGISTRATION:'ออเดอร์นี้อยู่ก่อนวันที่มีผลจดทะเบียน VAT กรุณาให้ผู้ทำบัญชีตรวจสอบ',TAX_SETTINGS_CONFLICT:'ข้อมูล VAT เปลี่ยนแล้ว กรุณาโหลดหน้าใหม่',BRANDING_CONFLICT:'ข้อมูลแบรนด์เปลี่ยนแล้ว กรุณาโหลดหน้าใหม่',TAX_INVOICE_CONFLICT:'ข้อมูลออเดอร์หรือการตั้งค่าเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่',TAX_INVOICE_TOTAL_MISMATCH:'ยอดรวมทุกรายการต้องตรงกับยอดออเดอร์',TAX_ORDER_NOT_ELIGIBLE:'ออเดอร์นี้ยังออกใบกำกับภาษีไม่ได้',TAX_INVOICE_ALREADY_ISSUED:'ออเดอร์นี้ออกใบกำกับภาษีแล้ว กรุณาเปิดเอกสารเดิม',REWARD_IMAGE_TOO_LARGE:'รูปต้องไม่เกิน 2 MB',INVALID_REWARD_IMAGE:'ใช้รูป PNG, JPG หรือ WebP ที่เปิดอ่านได้'};
  return Response.json({error:messages[error instanceof Error?error.message:'']??'กรุณาตรวจข้อมูลให้ครบและลองอีกครั้ง'},{status:400});
 }
}
