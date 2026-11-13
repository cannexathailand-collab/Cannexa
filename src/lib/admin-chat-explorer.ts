import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {db,currentShopSlug} from './db';
import type {ChatData} from './admin-chat';

const excludedModels=new Set(['OAuthAttempt','CustomerAccessLink','RateLimit','GmailOAuthAttempt','DriveOAuthAttempt','LineOaBrowserCommand']);
const secretField=/(session|encrypted|secret|token|password|salt|hash|signature|nonce|verifier|cookie|credential|privateKey|accessKey|lineUserKey|messageKey|eventKey|groupKey|key$|metaFbc|sourceUrl|linkUrl)/i;
const readable=Prisma.dmmf.datamodel.models.filter(model=>!model.name.startsWith('Platform')&&!excludedModels.has(model.name));
const fieldsFor=(model:typeof readable[number])=>model.fields.filter(field=>['scalar','enum'].includes(field.kind)&&!['Json','Bytes','Unsupported'].includes(field.type)&&!secretField.test(field.name)&&!(model.name==='UserAccount'&&field.name==='version'));
const catalogs=new Map(readable.map(model=>[model.name,{model,fields:fieldsFor(model)}]).filter(([,entry])=>(entry as {fields:unknown[]}).fields.length) as [string,{model:typeof readable[number];fields:ReturnType<typeof fieldsFor>}][]);
const titles:Record<string,string>={Customer:'ลูกค้า',OrderIntake:'ออเดอร์',WebsiteOrder:'ออเดอร์เว็บไซต์',UserAccount:'บัญชีผู้ใช้งาน',LineMessageRecipient:'สถานะผู้รับ LINE',CustomerLineMessage:'ประวัติส่ง LINE',Commission:'ค่าคอมมิชชัน',SalesOrder:'ยอดขาย',Expense:'รายจ่าย',RecurringExpense:'รายจ่ายประจำ',Shipment:'การจัดส่ง',CodReceipt:'รับเงิน COD',StockProduct:'สต๊อกสินค้า',StockDispatch:'ตัดสต๊อก',StockReturn:'สินค้าตีกลับ',LineOaJob:'งานอัตโนมัติ LINE OA',AuditLog:'ประวัติการดำเนินการ',CrmReward:'ของรางวัล',CrmRewardRedemption:'แลกรางวัล',Affiliate:'ผู้แนะนำ',CustomerReceipt:'ใบเสร็จ',CustomerTaxInvoice:'ใบกำกับภาษี'};
const source=z.string().refine(value=>catalogs.has(value),'Unknown source');
const filter=z.object({field:z.string().max(80),op:z.enum(['eq','neq','contains','gt','gte','lt','lte','isNull','notNull']),value:z.string().max(500)}).strict();
const readInput=z.object({source,fields:z.array(z.string().max(80)).max(12),filters:z.array(filter).max(10),orderBy:z.string().max(80),direction:z.enum(['asc','desc']),limit:z.number().int().min(1).max(30),offset:z.number().int().min(0).max(10000)}).strict();
const aggregateInput=z.object({source,filters:z.array(filter).max(10),groupBy:z.array(z.string().max(80)).max(2),sumFields:z.array(z.string().max(80)).max(5)}).strict();
const parameters=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const filterSchema={type:'array',maxItems:10,items:parameters({field:{type:'string'},op:{type:'string',enum:['eq','neq','contains','gt','gte','lt','lte','isNull','notNull']},value:{type:'string',description:'String form of the value. Empty for isNull/notNull.'}})};
export const explorerTools=[
 {type:'function',name:'list_data_sources',description:'Discover all readable business data sources in this shop, including LINE state, users, customers, rewards, delivery, automation jobs and audit history. Owner only.',strict:true,parameters:parameters({})},
 {type:'function',name:'describe_data_sources',description:'Inspect available scalar fields and types before querying. These are the only fields the server accepts. Owner only.',strict:true,parameters:parameters({sources:{type:'array',items:{type:'string'},minItems:1,maxItems:4}})},
 {type:'function',name:'read_data_source',description:'Read selected fields and filtered records from one described business source. Never SQL. Owner only. Empty fields chooses safe defaults. Empty orderBy chooses a default. Money fields ending Satang are integer satang.',strict:true,parameters:parameters({source:{type:'string'},fields:{type:'array',items:{type:'string'},maxItems:12},filters:filterSchema,orderBy:{type:'string'},direction:{type:'string',enum:['asc','desc']},limit:{type:'integer',minimum:1,maximum:30},offset:{type:'integer',minimum:0,maximum:10000}})},
 {type:'function',name:'aggregate_data_source',description:'Count or sum matching records, optionally group by one or two described scalar fields. Owner only. Raw sums do not replace recognized-sales/accounting reports. Up to 30 groups are shown; overall totals include all matches.',strict:true,parameters:parameters({source:{type:'string'},filters:filterSchema,groupBy:{type:'array',items:{type:'string'},maxItems:2},sumFields:{type:'array',items:{type:'string'},maxItems:5}})},
];
export function readableChatSources(){return [...catalogs].map(([name,{fields}])=>({source:name,title:titles[name]??name,fieldCount:fields.length}));}
export function describeChatSource(name:string){const entry=catalogs.get(name);if(!entry)throw Error('UNKNOWN_SOURCE');return {source:name,title:titles[name]??name,fields:entry.fields.map(field=>({name:field.name,type:field.type,nullable:!field.isRequired,...(field.kind==='enum'?{values:Prisma.dmmf.datamodel.enums.find(item=>item.name===field.type)?.values.map(item=>item.name)}:{})}))};}
function entryFor(name:string){const entry=catalogs.get(name);if(!entry)throw Error('UNKNOWN_SOURCE');return entry;}
function fieldFor(name:string,field:string){const found=entryFor(name).fields.find(item=>item.name===field);if(!found)throw Error('UNREADABLE_FIELD');return found;}
function parsedValue(field:ReturnType<typeof fieldFor>,value:string){
 if(field.kind==='enum'){const allowed=Prisma.dmmf.datamodel.enums.find(item=>item.name===field.type)?.values.map(item=>item.name);if(!allowed?.includes(value))throw Error('INVALID_VALUE');return value;}
 if(field.type==='Boolean'){if(!['true','false'].includes(value))throw Error('INVALID_VALUE');return value==='true';}
 if(field.type==='DateTime'){const date=new Date(value);if(!Number.isFinite(+date))throw Error('INVALID_VALUE');return date;}
 if(['Int','Float','Decimal','BigInt'].includes(field.type)){if(!/^-?\d+(\.\d+)?$/.test(value))throw Error('INVALID_VALUE');const n=Number(value);if(!Number.isFinite(n)||(['Int','BigInt'].includes(field.type)&&!Number.isSafeInteger(n)))throw Error('INVALID_VALUE');return field.type==='BigInt'?BigInt(value):n;}
 return value;
}
export function explorerWhere(name:string,filters:z.infer<typeof filter>[]){
 return {AND:filters.map(item=>{
  const field=fieldFor(name,item.field);
  if(item.op==='isNull'||item.op==='notNull'){if(field.isRequired)throw Error('INVALID_NULL_FILTER');return {[field.name]:item.op==='isNull'?null:{not:null}};}
  const value=parsedValue(field,item.value);
  if(item.op==='contains'){if(field.type!=='String')throw Error('INVALID_FILTER');return {[field.name]:{contains:value,mode:'insensitive'}};}
  return {[field.name]:item.op==='eq'?value:item.op==='neq'?{not:value}:{[item.op]:value}};
 })};
}
const safeValue=(value:unknown):unknown=>value instanceof Date?value.toISOString():typeof value==='bigint'?value.toString():value instanceof Prisma.Decimal?value.toString():typeof value==='string'?value.replace(/\bsk-[A-Za-z0-9_-]{12,}/g,'[redacted]').slice(0,1500):value;
const cleanRow=(row:Record<string,unknown>)=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,safeValue(value)]));
const labels:Record<string,string>={id:'รหัสรายการ',code:'รหัส',name:'ชื่อ',status:'สถานะ',phase:'ขั้นตอน',account:'บัญชี',createdAt:'สร้างเมื่อ',updatedAt:'อัปเดตเมื่อ',orderNumber:'เลขออเดอร์',customerCode:'รหัสลูกค้า',displayName:'ชื่อ LINE',friendFlag:'เพิ่มเพื่อน',lastMessageAt:'ข้อความล่าสุด',active:'เปิดใช้งาน',count:'จำนวน',retryCount:'จำนวนครั้งที่ลองซ้ำ',progressMessage:'ความคืบหน้า',error:'ข้อผิดพลาด',eventAt:'วันที่รายการ',payment:'การชำระเงิน',amountSatang:'จำนวนเงิน (บาท)',revenueSatang:'ยอดเงิน (บาท)',totalCostSatang:'ต้นทุนรวม (บาท)'};
const label=(field:string)=>labels[field]??(field.endsWith('Satang')?field.replace(/Satang$/,' (บาท)'):field);
const cell=(field:string,value:unknown)=>value===null?'ไม่ระบุ':field.endsWith('Satang')&&Number.isFinite(Number(value))?(Number(value)/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}):String(value);
function reference(name:string){const slug=currentShopSlug(),base=slug?'/shops/'+encodeURIComponent(slug):'/admin';const page=name.includes('Stock')?'stock':name.includes('Expense')||name.includes('Commission')||name==='SalesOrder'?'accounting':name.includes('Customer')||name.includes('Crm')?'customers':name==='UserAccount'?'users':name.includes('Order')||name==='Shipment'?'orders':slug?'connections':'audit';return {title:titles[name]??name,url:base+'/'+(page==='orders'&&!slug?'orders/list':page==='customers'&&!slug?'crm':page),readAt:new Date().toISOString()};}
export async function exploreChatData(role:string,name:string,args:unknown):Promise<ChatData>{
 if(role!=='owner')throw Error('CHAT_FORBIDDEN');
 if(name==='list_data_sources')return {source:reference('AuditLog'),data:{sources:readableChatSources(),note:'Only current shop. Credentials, session material, binary files and arbitrary JSON are not exposed. Use dedicated tools for interpreted sales, accounting, stock and customer LINE status.'}};
 if(name==='describe_data_sources'){const input=z.object({sources:z.array(source).min(1).max(4)}).strict().parse(args);return {source:reference(input.sources[0]),data:input.sources.map(describeChatSource)};}
 if(name==='read_data_source'){
  const input=readInput.parse(args),entry=entryFor(input.source),where=explorerWhere(input.source,input.filters);
  const fields=input.fields.length?[...new Set(input.fields)]:entry.fields.slice(0,8).map(field=>field.name);fields.forEach(field=>fieldFor(input.source,field));
  const order=input.orderBy||entry.fields.find(field=>field.name==='createdAt')?.name||entry.fields[0].name;fieldFor(input.source,order);
  const delegate=(db as any)[input.source[0].toLowerCase()+input.source.slice(1)];
  const [total,raw]=await Promise.all([delegate.count({where}),delegate.findMany({where,select:Object.fromEntries(fields.map(field=>[field,true])),orderBy:{[order]:input.direction},take:input.limit,skip:input.offset})]);
  const rows=raw.map(cleanRow);
  return {source:reference(input.source),data:{source:input.source,filters:input.filters,total,offset:input.offset,shownCount:rows.length,rows,hasMore:input.offset+rows.length<total,moneyUnit:'Fields ending Satang are satang; all other numbers retain their schema units.'},table:{title:titles[input.source]??input.source,columns:fields.map(label),total,rows:rows.map((row:Record<string,unknown>)=>({cells:fields.map(field=>cell(field,row[field]))}))}};
 }
 if(name==='aggregate_data_source'){
  const input=aggregateInput.parse(args),where=explorerWhere(input.source,input.filters);
  input.groupBy.forEach(field=>fieldFor(input.source,field));input.sumFields.forEach(field=>{if(!['Int','Float','Decimal','BigInt'].includes(fieldFor(input.source,field).type))throw Error('INVALID_SUM');});
  const delegate=(db as any)[input.source[0].toLowerCase()+input.source.slice(1)],sums=Object.fromEntries(input.sumFields.map(field=>[field,true]));
  const totals=await delegate.aggregate({where,_count:{_all:true},...(input.sumFields.length?{_sum:sums}:{})});
  const groups=input.groupBy.length?await delegate.groupBy({by:input.groupBy,where,_count:{_all:true},...(input.sumFields.length?{_sum:sums}:{}),orderBy:{_count:{[input.groupBy[0]]:'desc'}},take:31}):[];
  const rows=groups.slice(0,30).map((group:any)=>({...cleanRow(Object.fromEntries(input.groupBy.map(field=>[field,group[field]]))),count:group._count._all,...cleanRow(group._sum??{})}));
  const data={source:input.source,filters:input.filters,count:totals._count._all,sums:cleanRow(totals._sum??{}),groups:rows,groupsTruncated:groups.length>30,moneyUnit:'Fields ending Satang are satang. These raw-record sums are not recognized sales or net profit.'};
  const columns=[...input.groupBy,'count',...input.sumFields];
  return {source:reference(input.source),data,...(rows.length?{table:{title:titles[input.source]??input.source,columns:columns.map(label),total:rows.length,rows:rows.map((row:Record<string,unknown>)=>({cells:columns.map(field=>cell(field,row[field]))}))}}:{})};
 }
 throw Error('UNKNOWN_TOOL');
}
