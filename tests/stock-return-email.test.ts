import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {sha} from '../src/lib/crypto';
import {encryptGmail} from '../src/lib/gmail';
import {importGmailReports} from '../src/lib/gmail-reports';
import {parseStockReturnEmail,recordReturnEmail,STOCK_RETURN_SENDER,type StockReturnEmail} from '../src/lib/stock-return-email';

const tracking='WA096250152TH',otherTracking='EA123456789TH';
const headers=['ลำดับ','เลขพัสดุ','ชื่อ - นามสกุลผู้รับ','COD Amount (บาท)','สถานะ (ตามหน้าเว็บปณ. )','เหตุผลของปลายทาง','หมายเหตุของปลายทาง'];
const table=(status='ผู้รับปฏิเสธการรับ',code=tracking,reason='อื่นๆ',note='ลูกค้าแจ้งไม่รับสินค้า')=>'<table><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr><tr>'+['1',code,'Aneli','860',status,reason,note].map(v=>'<td>'+v+'</td>').join('')+'</tr></table>';
const email=(overrides:Partial<StockReturnEmail>={}):StockReturnEmail=>({messageId:'return-message',sender:STOCK_RETURN_SENDER,subject:'แจ้งพัสดุถูกตีกลับ 1 รายการ',reportedAt:new Date('2026-11-06T01:00:00Z'),html:table(),...overrides});
function replace(t:TestContext,target:any,key:string,value:any){const prior=target[key];target[key]=value;t.after(()=>{target[key]=prior;});}
function harness(t:TestContext){
 const state={returns:new Map<string,any>(),reports:new Map<string,any>(),audits:new Map<string,any>(),shipments:new Map<string,any>()};
 replace(t,db,'$transaction',async(fn:any)=>fn(db));replace(t,db,'$queryRawUnsafe',async()=>[]);
 replace(t,db.stockReturnReport,'findUnique',async({where}:any)=>state.reports.get(where.id)??null);
 replace(t,db.stockReturnReport,'create',async({data}:any)=>{assert.ok(!state.reports.has(data.id));state.reports.set(data.id,data);return data;});
 replace(t,db.stockReturn,'findUnique',async({where}:any)=>state.returns.get(where.tracking)??null);
 replace(t,db.stockReturn,'upsert',async({where,create,update}:any)=>{const previous=state.returns.get(where.tracking),next=previous?{...previous,...update}:{id:'return-'+where.tracking,receivedAt:null,historySnapshot:null,historySavedAt:null,...create};state.returns.set(where.tracking,next);return next;});
 replace(t,db.shipment,'findUnique',async({where}:any)=>state.shipments.get(where.tracking)??null);
 replace(t,db.auditLog,'findUnique',async({where}:any)=>state.audits.get(where.id)??null);
 replace(t,db.auditLog,'upsert',async({where,create}:any)=>{if(!state.audits.has(where.id))state.audits.set(where.id,create);return state.audits.get(where.id);});
 replace(t,db.stockSheetOperation,'upsert',async()=>{assert.fail('Email ingestion must never write stock');});
 return state;
}

test('observed MyOrder refusal email is return-in-transit evidence, not proof that stock came back',()=>{
 const parsed=parseStockReturnEmail(email());assert.equal(parsed.ignored,false);assert.equal(parsed.reports.length,1);
 assert.equal(parsed.reports[0].tracking,tracking);assert.equal(parsed.reports[0].stage,'IN_TRANSIT');assert.match(parsed.reports[0].issues[0],/รอยืนยันรับสินค้าคืน/);
 assert.equal(parsed.reports[0].format,'MYORDER_RETURN_TABLE');assert.match(parsed.reports[0].reason,/ผู้รับปฏิเสธการรับ \/ อื่นๆ/);
});

test('only exact receipt-completed text maps the carrier receipt status',()=>{
 for(const status of ['นำส่งคืนผู้ฝากส่งสำเร็จ','ส่งคืนถึงผู้ส่งแล้ว'])assert.equal(parseStockReturnEmail(email({html:table(status)})).reports[0].stage,'RECEIVED');
 for(const status of ['ยังไม่ส่งคืนถึงผู้ส่งแล้ว','กำลังนำส่งคืนผู้ฝากส่งสำเร็จ','ส่งคืน','นำจ่ายสำเร็จ','ผู้รับปฏิเสธการรับ']){
  const parsed=parseStockReturnEmail(email({html:table(status,tracking,'ส่งคืนถึงผู้ส่งแล้ว','นำส่งคืนผู้ฝากส่งสำเร็จ')}));
  assert.equal(parsed.reports[0].stage,'IN_TRANSIT',status);assert.ok(parsed.reports[0].issues.length);
 }
});

test('known table mapping tolerates entity formatting and nested layout tables without mixing columns',()=>{
 const html='<table><tr><td>รายงาน<table><tr>'+headers.map(h=>'<td><span>'+h.replaceAll(' ','&nbsp;')+'</span></td>').join('')+'</tr><tr>'+['1',tracking,'Aneli','860','<b>ส่งคืนถึงผู้ส่งแล้ว</b>','อื่นๆ',''].map(v=>'<td>'+v+'</td>').join('')+'</tr></table></td></tr></table>';
 const parsed=parseStockReturnEmail(email({html}));assert.equal(parsed.reports.length,1);assert.equal(parsed.reports[0].stage,'RECEIVED');assert.equal(parsed.reports[0].format,'MYORDER_RETURN_TABLE');
});

test('unrecognized layouts and collapsed plaintext only create review evidence for exact ThaiPost tracking',()=>{
 const inputs=[{html:table('ส่งคืนถึงผู้ส่งแล้ว').replace('สถานะ (ตามหน้าเว็บปณ. )','สถานะใหม่')},{html:'',text:'1 '+tracking+' Aneli 860 ส่งคืนถึงผู้ส่งแล้ว'}];
 for(const input of inputs){const parsed=parseStockReturnEmail(email(input));assert.equal(parsed.reports.length,1);assert.equal(parsed.reports[0].stage,'IN_TRANSIT');assert.equal(parsed.reports[0].format,'UNRECOGNIZED_RETURN_EMAIL');}
 for(const value of ['WA096250152','WA 096250152 TH','XWA096250152THX',tracking+'Aneli'])assert.equal(parseStockReturnEmail(email({html:'',text:value})).reports.length,0);
});

test('untrusted senders, forwarded subjects and quoted messages cannot supply receipt evidence',()=>{
 assert.equal(parseStockReturnEmail(email({sender:'attacker@example.com'})).ignored,true);
 assert.equal(parseStockReturnEmail(email({subject:'Fwd: แจ้งพัสดุถูกตีกลับ 1 รายการ'})).ignored,true);
 assert.equal(parseStockReturnEmail(email({subject:'รายงานทั่วไป'})).ignored,true);
 for(const html of ['<blockquote>'+table('ส่งคืนถึงผู้ส่งแล้ว')+'</blockquote>','<div class="gmail_quote">'+table('ส่งคืนถึงผู้ส่งแล้ว')+'</div>']){
  const parsed=parseStockReturnEmail(email({html}));assert.equal(parsed.reports.length,0);assert.match(parsed.issues[0],/ข้อความส่งต่อ/);
 }
});

test('duplicate tracking rows and merged or shifted tables are review-only',()=>{
 const duplicate=parseStockReturnEmail(email({html:table('ส่งคืนถึงผู้ส่งแล้ว')+table('ผู้รับปฏิเสธการรับ')}));
 assert.equal(duplicate.reports.length,1);assert.equal(duplicate.reports[0].stage,'IN_TRANSIT');assert.match(duplicate.reports[0].issues[0],/ซ้ำ/);
 const merged=parseStockReturnEmail(email({html:table('ส่งคืนถึงผู้ส่งแล้ว').replace('<td>1</td>','<td colspan="2">1</td>')}));
 assert.equal(merged.reports[0].stage,'IN_TRANSIT');assert.equal(merged.reports[0].format,'UNRECOGNIZED_RETURN_EMAIL');
});

test('return email recording is idempotent and links only an exact known shipment tracking',async t=>{
 const h=harness(t);h.shipments.set(tracking,{tracking,orderId:'order1'});
 const result=await recordReturnEmail(email(),'test');assert.equal(result.imported,true);assert.equal(result.reports,1);
 const row=h.returns.get(tracking);assert.equal(row.orderId,'order1');assert.equal(row.stage,'IN_TRANSIT');assert.equal(row.status,'NEEDS_REVIEW');assert.equal(row.receivedAt,null);assert.equal(row.evidence.length,1);assert.equal(row.items.length,0);
 assert.equal(h.reports.get(sha('return-message:'+tracking)).sender,STOCK_RETURN_SENDER);
 assert.equal((await recordReturnEmail(email(),'test')).imported,false);assert.equal(h.reports.size,1);assert.equal(h.returns.get(tracking).evidence.length,1);
 await recordReturnEmail(email({messageId:'unlinked',html:table('送信',otherTracking)}),'test');assert.equal(h.returns.get(otherTracking).orderId,null);
});

test('carrier receipt report waits for staff confirmation and later mail preserves confirmed receipt',async t=>{
 const h=harness(t);await recordReturnEmail(email(),'test');
 const receivedAt=new Date('2026-11-07T02:00:00Z');
 await recordReturnEmail(email({messageId:'receipt',reportedAt:receivedAt,html:table('ส่งคืนถึงผู้ส่งแล้ว')}),'test');
 let row=h.returns.get(tracking);assert.equal(row.stage,'IN_TRANSIT');assert.equal(row.status,'NEEDS_REVIEW');assert.equal(row.receivedAt,null);assert.deepEqual(row.reportedAt,receivedAt);assert.ok(row.issues.length);
 row.stage='RECEIVED';row.status='PENDING';row.receivedAt=receivedAt;row.evidence.push({kind:'MANUAL_RECEIPT',actor:'store-user'});
 await recordReturnEmail(email({messageId:'late-transit',reportedAt:new Date('2026-11-08T02:00:00Z')}),'test');
 row=h.returns.get(tracking);assert.equal(row.stage,'RECEIVED');assert.equal(row.status,'PENDING');assert.deepEqual(row.reportedAt,receivedAt);assert.equal(row.evidence.length,4);assert.deepEqual(row.receivedAt,receivedAt);
});

test('new evidence preserves posted history, costs and terminal decisions while retaining historical reports',async t=>{
 const h=harness(t);await recordReturnEmail(email({html:table('ส่งคืนถึงผู้ส่งแล้ว')}),'test');
 const history={items:[{code:'A1',quantityMilliG:1000}]},savedAt=new Date('2026-11-06T03:00:00Z');
 Object.assign(h.returns.get(tracking),{status:'POSTED',historySnapshot:history,historySavedAt:savedAt,totalCostSatang:150});
 await recordReturnEmail(email({messageId:'old-evidence',reportedAt:new Date('2024-01-01T00:00:00Z')}),'test');
 const row=h.returns.get(tracking);assert.equal(row.status,'POSTED');assert.deepEqual(row.historySnapshot,history);assert.deepEqual(row.historySavedAt,savedAt);assert.equal(row.totalCostSatang,150);assert.equal(row.evidence.length,2);
 assert.deepEqual(h.reports.get(sha('old-evidence:'+tracking)).reportedAt,new Date('2024-01-01T00:00:00Z'));
 row.status='NO_STOCK_CHANGE';await recordReturnEmail(email({messageId:'receipt-repeat',html:table('ส่งคืนถึงผู้ส่งแล้ว')}),'test');assert.equal(h.returns.get(tracking).status,'NO_STOCK_CHANGE');
});

test('unknown mail without a tracking number produces one review audit instead of silent success',async t=>{
 const h=harness(t),input=email({html:'รูปแบบรายงานใหม่ ไม่มีเลขพัสดุ'});
 assert.equal((await recordReturnEmail(input,'test')).imported,true);assert.equal(h.returns.size,0);assert.equal(h.reports.size,0);assert.equal(h.audits.size,1);assert.equal([...h.audits.values()][0].action,'STOCK_RETURN_EMAIL_REVIEW');
 assert.equal((await recordReturnEmail(input,'test')).imported,false);assert.equal(h.audits.size,1);
});

test('Gmail search and MIME ingestion import direct return body emails without an attachment',async t=>{
 const h=harness(t),secret=process.env.SESSION_SECRET;process.env.SESSION_SECRET='return-email-test';t.after(()=>{if(secret===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=secret;});
 replace(t,db.gmailConnection,'findUnique',async()=>({encryptedConfig:encryptGmail({clientId:'test.apps.googleusercontent.com',clientSecret:'secret'}),encryptedToken:encryptGmail({refreshToken:'refresh'}),revision:'revision',email:'test@example.com'}));
 replace(t,db.gmailConnection,'updateMany',async()=>({count:1}));
 let query='',attachmentReads=0;
 replace(t,globalThis,'fetch',async(input:any)=>{
  const url=new URL(String(input));if(url.hostname==='oauth2.googleapis.com')return Response.json({access_token:'token'});
  if(url.pathname.endsWith('/messages')){query=url.searchParams.get('q')??'';return Response.json({messages:[{id:'return-message'}]});}
  if(url.pathname.includes('/attachments/')){attachmentReads++;assert.fail('Return body should not require an attachment');}
  if(url.searchParams.get('format')==='metadata')return Response.json({payload:{headers:[{name:'From',value:'MyOrder <'+STOCK_RETURN_SENDER+'>'},{name:'Subject',value:email().subject}]}});
  return Response.json({internalDate:String(email().reportedAt.getTime()),payload:{mimeType:'multipart/alternative',parts:[{mimeType:'text/plain',body:{data:Buffer.from(tracking+' ส่งคืนถึงผู้ส่งแล้ว').toString('base64url')}},{mimeType:'text/html',body:{data:Buffer.from(table()).toString('base64url')}}]}});
 });
 const result=await importGmailReports('test');assert.equal(result.imported,1);assert.equal(attachmentReads,0);assert.equal(h.returns.get(tracking).stage,'IN_TRANSIT');
 assert.ok(query.includes('newer_than:30d'));assert.ok(query.includes('(from:account-thaipost-freight@myorder.ai has:attachment)'));assert.ok(query.includes('(from:account-thaipost-cod@myorder.ai has:attachment)'));assert.ok(query.endsWith('from:'+STOCK_RETURN_SENDER+'}'));
 assert.equal((await importGmailReports('test',['return-message'])).imported,0);assert.equal(h.reports.size,1);
});
