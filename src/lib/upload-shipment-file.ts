import {bindDatabase} from './db';
import {after} from 'next/server';
import {parseManualShipmentFile} from './manual-shipment-file';
import {previewManualShipments,importManualShipments} from './manual-shipments';
import {enqueueStockDispatches} from './stock-dispatch-worker';
import {recordRejectedShipmentMatches} from './rejected-shipments';

export async function uploadShipmentFile(request:Request,actor:string){
 try{
  if(Number(request.headers.get('content-length')??0)>3*1024*1024)throw Error('ไฟล์ต้องมีขนาดไม่เกิน 2 MB');
  if(request.headers.get('content-type')?.includes('multipart/form-data')){
   const form=await request.formData(),file=form.get('file');
   if(!(file instanceof File))throw Error('กรุณาเลือกไฟล์ Excel หรือ CSV');
   const rows=await parseManualShipmentFile(Buffer.from(await file.arrayBuffer()),file.name);
   const preview=await previewManualShipments(rows);
   await recordRejectedShipmentMatches(actor,file.name,preview);
   return Response.json({rows:preview},{headers:{'Cache-Control':'private, no-store'}});
  }
  const text=await request.text();if(text.length>200000)throw Error('ข้อมูลนำเข้ามีขนาดใหญ่เกินไป');
  const result=await importManualShipments(actor,JSON.parse(text));
  after(bindDatabase(async()=>{for(let i=0;i<result.orderIds.length;i+=200)await enqueueStockDispatches(result.orderIds.slice(i,i+200)).catch(()=>{});}));
  return Response.json({ok:true,count:result.count},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'นำเข้าไม่สำเร็จ กรุณาลองใหม่'},{status:400});}
}
