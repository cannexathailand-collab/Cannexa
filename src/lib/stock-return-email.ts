import {transaction,userLock} from './db';
import {sha} from './crypto';

export const STOCK_RETURN_SENDER='sujittra@myorder.ai';
const waitingReceipt='แจ้งตีกลับแล้ว รอยืนยันรับสินค้าคืนครบก่อนเพิ่มสต๊อก';
const unknownFormat='รูปแบบอีเมลตีกลับไม่ตรงกับรายงานที่รองรับ ต้องตรวจสอบก่อนเพิ่มสต๊อก';
const unknownStatus='สถานะพัสดุตีกลับยังไม่ยืนยันว่าผู้ส่งได้รับสินค้าคืน';
const compact=(value:string)=>value.normalize('NFKC').replace(/\s+/g,'');
const clean=(value:string)=>value.normalize('NFKC').replace(/\s+/g,' ').trim();
const receivedStatuses=new Set(['นำส่งคืนผู้ฝากส่งสำเร็จ','ส่งคืนถึงผู้ส่งแล้ว'].map(compact));
const transitStatuses=new Set(['ผู้รับปฏิเสธการรับ','อยู่ระหว่างส่งคืน','กำลังส่งคืนผู้ฝากส่ง','ตีกลับ','นำส่งไม่สำเร็จ'].map(compact));
const trackingPattern=/^[A-Z]{2}\d{9}TH$/;
const tableHeaders=['ลำดับ','เลขพัสดุ','ชื่อ-นามสกุลผู้รับ','CODAmount(บาท)','สถานะ(ตามหน้าเว็บปณ.)','เหตุผลของปลายทาง','หมายเหตุของปลายทาง'].map(compact);
const decodeEntities=(value:string)=>value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(entity,key:string)=>{
 if(key[0]==='#'){const point=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return Number.isInteger(point)&&point>0&&point<=0x10ffff?String.fromCodePoint(point):entity;}
 return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '} as Record<string,string>)[key.toLowerCase()]??entity;
});
const htmlText=(html:string)=>clean(decodeEntities(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ').replace(/<[^>]*>/g,' ')));

export type StockReturnEmail={messageId:string;sender:string;subject:string;reportedAt:Date;html?:string;text?:string};
export type ParsedStockReturnReport={tracking:string;stage:'IN_TRANSIT'|'RECEIVED';reason:string;statusText:string;issues:string[];format:'MYORDER_RETURN_TABLE'|'UNRECOGNIZED_RETURN_EMAIL'};
export type ParsedStockReturnEmail={ignored:boolean;reports:ParsedStockReturnReport[];issues:string[]};

// Read only cell text from each table; nested layout tables cannot supply cells
// to their parent. This does not execute HTML or interpret links as evidence.
function htmlTables(html:string){
 const tables:string[][][]=[],stack:{rows:string[][];row?:string[];cell?:string;spanned:boolean}[]=[];let ignoredTag='';
 for(const token of html.match(/<(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+/g)??[]){
  const tag=token.match(/^<\s*(\/?)\s*([a-z0-9]+)/i),name=tag?.[2].toLowerCase(),closing=!!tag?.[1];
  if(ignoredTag){if(closing&&name===ignoredTag)ignoredTag='';continue;}
  if(!closing&&(name==='script'||name==='style')){ignoredTag=name;continue;}
  if(name==='table'){
   if(!closing)stack.push({rows:[],spanned:false});
   else{const table=stack.pop();if(table&&!table.spanned)tables.push(table.rows);}
   continue;
  }
  const table=stack.at(-1);if(!table)continue;
  if(name==='tr'){if(!closing)table.row=[];else if(table.row){table.rows.push(table.row);table.row=undefined;}continue;}
  if(name==='td'||name==='th'){
   if(!closing){table.cell='';if(/\b(?:rowspan|colspan)\s*=\s*["']?(?:[2-9]|\d{2})/i.test(token))table.spanned=true;}
   else if(table.row&&table.cell!==undefined){table.row.push(clean(decodeEntities(table.cell)));table.cell=undefined;}
   continue;
  }
  if(table.cell!==undefined)table.cell+=tag?' ':token;
 }
 return tables;
}

export function parseStockReturnEmail(input:StockReturnEmail):ParsedStockReturnEmail{
 const ignored={ignored:true,reports:[],issues:[]} as ParsedStockReturnEmail;
 if(input.sender.trim().toLowerCase()!==STOCK_RETURN_SENDER)return ignored;
 if(!/^แจ้งพัสดุถูกตีกลับ(?:\s*\d+\s*รายการ)?$/.test(clean(input.subject)))return ignored;
 if(!input.messageId||!Number.isFinite(input.reportedAt.getTime()))throw Error('STOCK_RETURN_EMAIL_INVALID');
 const html=input.html??'',text=input.text??'';
 if(Buffer.byteLength(html)+Buffer.byteLength(text)>2*1024*1024)return {ignored:false,reports:[],issues:['อีเมลตีกลับมีขนาดเกินกำหนด ต้องตรวจสอบด้วยตนเอง']};
 if(/<blockquote\b|\b(?:gmail_quote|yahoo_quoted|moz-cite-prefix)\b/i.test(html)||/(?:-{2,}\s*Forwarded message\s*-{2,}|Begin forwarded message:)/i.test(text))return {ignored:false,reports:[],issues:['อีเมลมีข้อความส่งต่อหรือข้อความอ้างอิง ต้องตรวจสอบต้นฉบับก่อนเพิ่มสต๊อก']};
 const reports:ParsedStockReturnReport[]=[],issues:string[]=[];
 for(const rows of htmlTables(html)){
  const headerIndex=rows.findIndex(row=>row.length===tableHeaders.length&&row.every((cell,index)=>compact(cell)===tableHeaders[index]));
  if(headerIndex<0)continue;
  for(const row of rows.slice(headerIndex+1)){
   if(row.every(cell=>!cell))continue;
   const tracking=clean(row[1]??'').toUpperCase();
   if(row.length!==tableHeaders.length||!/^\d+$/.test(row[0])||!trackingPattern.test(tracking)){issues.push(unknownFormat);continue;}
   const statusText=clean(row[4]),status=compact(statusText),stage=receivedStatuses.has(status)?'RECEIVED':'IN_TRANSIT';
   const rowIssues=stage==='RECEIVED'?[]:transitStatuses.has(status)?[waitingReceipt]:[unknownStatus];
   reports.push({tracking,stage,statusText,reason:row.slice(4).filter(Boolean).join(' / ').slice(0,4000),issues:rowIssues,format:'MYORDER_RETURN_TABLE'});
  }
 }
 const directText=htmlText(html)+' '+text;
 const found=[...new Set(directText.normalize('NFKC').toUpperCase().match(/(?<![A-Z0-9])[A-Z]{2}\d{9}TH(?![A-Z0-9])/g)??[])];
 for(const tracking of found)if(!reports.some(row=>row.tracking===tracking))reports.push({tracking,stage:'IN_TRANSIT',statusText:'',reason:unknownFormat,issues:[unknownFormat],format:'UNRECOGNIZED_RETURN_EMAIL'});
 const unique=new Map<string,ParsedStockReturnReport>();
 for(const report of reports){
  if(unique.has(report.tracking))unique.set(report.tracking,{...report,stage:'IN_TRANSIT',issues:['พบเลขพัสดุซ้ำในอีเมลเดียวกัน ต้องตรวจสอบสถานะคืนสินค้า'],reason:unknownFormat,format:'UNRECOGNIZED_RETURN_EMAIL'});
  else unique.set(report.tracking,report);
 }
 if(!unique.size)issues.push('ไม่พบเลขพัสดุไปรษณีย์ไทยที่ยืนยันได้ในอีเมลตีกลับ');
 return {ignored:false,reports:[...unique.values()],issues:[...new Set(issues)]};
}

export async function recordReturnEmail(input:StockReturnEmail,actor:string,connectionRevision?:string){
 const parsed=parseStockReturnEmail(input);
 if(parsed.ignored)return {imported:false,reports:0,issues:[] as string[]};
 return transaction(async tx=>{
  await userLock(tx,'gmail-reports');
  if(connectionRevision!==undefined){const connection=await tx.gmailConnection.findUnique({where:{id:'active'}});if(connection?.revision!==connectionRevision||!connection.encryptedToken)throw Error('GMAIL_RECONNECT');}
  let imported=false,count=0;
  for(const report of parsed.reports){
   const id=sha(input.messageId+':'+report.tracking);
   if(await tx.stockReturnReport.findUnique({where:{id}}))continue;
   const sender=input.sender.trim().toLowerCase(),evidence={reportId:id,messageId:input.messageId,sender,subject:input.subject,reportedAt:input.reportedAt.toISOString(),stage:report.stage,reason:report.reason,statusText:report.statusText,format:report.format};
   await tx.stockReturnReport.create({data:{id,messageId:input.messageId,tracking:report.tracking,sender,subject:input.subject,reportedAt:input.reportedAt,stage:report.stage,reason:report.reason}});
   const previous=await tx.stockReturn.findUnique({where:{tracking:report.tracking}}),shipment=await tx.shipment.findUnique({where:{tracking:report.tracking}});
   const stage=previous?.stage==='RECEIVED'?'RECEIVED':report.stage,terminal=previous&&['POSTED','NO_STOCK_CHANGE'].includes(previous.status),advanced=report.stage==='RECEIVED'&&previous?.stage!=='RECEIVED';
   const status=terminal||previous?.stage==='RECEIVED'?previous!.status:stage==='RECEIVED'?'PENDING':'NEEDS_REVIEW';
   const currentEvidence=Array.isArray(previous?.evidence)?previous.evidence:[];
   const reportIssues=[...new Set([...report.issues,...parsed.issues])];
   await tx.stockReturn.upsert({where:{tracking:report.tracking},create:{tracking:report.tracking,orderId:shipment?.orderId??null,stage,status,reportedAt:input.reportedAt,evidence:[evidence],items:[],issues:reportIssues},update:{
    ...(previous?.orderId?{}:{orderId:shipment?.orderId??null}),stage,status,evidence:[...currentEvidence,evidence],
    ...(terminal||previous?.stage==='RECEIVED'&&!advanced?{}:{issues:reportIssues}),
    // The report timestamp records when receipt evidence arrived; it is not a
    // guessed physical receipt timestamp. The return processor chooses its basis.
    ...(advanced||previous?.stage!=='RECEIVED'&&previous&&input.reportedAt>previous.reportedAt?{reportedAt:input.reportedAt}:{})
   }});
   imported=true;count++;
  }
  if(parsed.issues.length){
   const id='stock-return-email-review:'+sha(input.messageId),existing=await tx.auditLog.findUnique({where:{id}});
   await tx.auditLog.upsert({where:{id},create:{id,actor,action:'STOCK_RETURN_EMAIL_REVIEW',entityId:input.messageId,details:{sender:input.sender,subject:input.subject,reportedAt:input.reportedAt.toISOString(),issues:parsed.issues}},update:{}});
   imported||=!existing;
  }
  return {imported,reports:count,issues:parsed.issues};
 });
}
