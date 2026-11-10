import {saveReceiptSettings} from './customer-receipts';
export async function saveReceiptSettingsResponse(request:Request,actor:string){
 try{
  const text=await request.text();if(text.length>12000)throw Error('INVALID');
  await saveReceiptSettings(actor,JSON.parse(text));
  return Response.json({ok:true});
 }catch(error){
  if(error instanceof Error&&error.message==='RECEIPT_SETTINGS_CONFLICT')return Response.json({error:'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดหน้าล่าสุดก่อนบันทึก'},{status:409});
  return Response.json({error:'บันทึกไม่สำเร็จ กรุณาตรวจชื่อ ที่อยู่ และเลขผู้เสียภาษี 13 หลักถ้ามี แล้วลองใหม่'},{status:400});
 }
}
