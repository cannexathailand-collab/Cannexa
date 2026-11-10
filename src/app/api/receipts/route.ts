import {documentOperators,requireOrderDocumentAccess,type DocumentAccount} from '@/lib/order-document-access';
import {currentAccount,sameOrigin} from '@/lib/auth';
import {portalCustomer,hasPortalAccess} from '@/lib/customer-portal';
import {issueCustomerReceipt} from '@/lib/customer-receipts';

export async function POST(request:Request){
 try{await sameOrigin();}catch{return Response.json({error:'ไม่อนุญาตคำขอนี้',english:'Request not allowed'},{status:403});}
 let actor:string,customerCode:string|undefined,operator:DocumentAccount|undefined;
 try{const account=await currentAccount();if(!documentOperators.some(role=>role===account.role))throw Error('UNAUTHORIZED');actor=account.username;operator=account;}
 catch(error){
  if(!(error instanceof Error)||!['UNAUTHORIZED','FORBIDDEN'].includes(error.message))throw error;
  const {key,customer}=await portalCustomer();
  if(!customer||!await hasPortalAccess(key,customer.code))return Response.json({error:'กรุณาเข้าสู่ระบบ',english:'Please sign in'},{status:403});
  actor='customer:'+customer.code;customerCode=customer.code;
 }
 try{
  const text=await request.text();if(text.length>1000)throw Error('RECEIPT_NOT_FOUND');
  const input=JSON.parse(text);if(typeof input.orderId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(input.orderId))throw Error('RECEIPT_NOT_FOUND');
  if(operator)await requireOrderDocumentAccess(operator,input.orderId,true);
  const receipt=await issueCustomerReceipt(input.orderId,actor,customerCode,operator);
  return Response.json({id:receipt.id},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){
  const code=error instanceof Error?error.message:'';
  const errors:Record<string,[string,string,number]>={
   DOCUMENT_FORBIDDEN:['ไม่มีสิทธิ์เปิดเอกสารออเดอร์นี้','Order document unavailable',403],
   RECEIPT_NOT_FOUND:['ไม่พบออเดอร์','Order not found',404],
   RECEIPT_NOT_CONFIGURED:['ร้านยังไม่ได้ตั้งค่าข้อมูลผู้ออกใบเสร็จ','The store has not configured receipt details',409],
   RECEIPT_PAYMENT_PENDING:['ยังออกใบเสร็จไม่ได้ กรุณาตรวจสอบการรับเงินและสถานะออเดอร์','Receipt unavailable. Please check payment and order status',409],
  };
  const [message,english,status]=errors[code]??['ยังยืนยันการออกใบเสร็จไม่ได้ กรุณาลองใหม่','Unable to confirm receipt. Please try again',503];
  return Response.json({error:message,english},{status});
 }
}
