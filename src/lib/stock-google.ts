import {receiptKey,recoverReceipt,stockReceiptPlan,type StockReceiptResult} from './stock-receipt';
import {createSign} from 'node:crypto';import {z} from 'zod';import {db} from './db';import {decryptGmail} from './gmail';import {stockRows} from './stock-import';import {latestStockTab,type NewStockProduct} from './stock-product-input';
import {stockFederationConfig,federatedStockToken} from './stock-federation';
export const STOCK_SHEET_ID='1M4iAba3jBJew4PM4FXbdU5_VQaFfJOZObV606Aq_2GM';
export const STOCK_SHEET_URL='https://docs.google.com/spreadsheets/d/'+STOCK_SHEET_ID+'/edit';
export const stockServiceConfig=z.object({type:z.literal('service_account'),client_email:z.email().refine(v=>v.endsWith('.iam.gserviceaccount.com')),private_key:z.string().min(100).max(20000).refine(v=>v.includes('BEGIN PRIVATE KEY')),private_key_id:z.string().max(200).optional()});
export type StockServiceConfig=z.infer<typeof stockServiceConfig>;
export const stockConnectionConfig=z.union([stockServiceConfig,stockFederationConfig]);
type StockConnectionConfig=z.infer<typeof stockConnectionConfig>;
const cache=new Map<string,{token:string;expires:number}>();
export function serviceAssertion(config:StockServiceConfig,now=Date.now()){
 const head=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',...(config.private_key_id?{kid:config.private_key_id}:{})})).toString('base64url'),iat=Math.floor(now/1000),body=Buffer.from(JSON.stringify({iss:config.client_email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat,exp:iat+3600})).toString('base64url');const data=head+'.'+body;return data+'.'+createSign('RSA-SHA256').update(data).sign(config.private_key,'base64url');
}
async function accessToken(config:StockServiceConfig,revision?:string){const saved=revision?cache.get(revision):null;if(saved&&saved.expires>Date.now()+60000)return saved.token;const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:serviceAssertion(config)}),cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('STOCK_GOOGLE_AUTH_FAILED');const result=z.object({access_token:z.string(),expires_in:z.number()}).parse(await response.json());if(revision){cache.clear();cache.set(revision,{token:result.access_token,expires:Date.now()+result.expires_in*1000});}return result.access_token;}
export async function stockGoogleClient(override?:StockConnectionConfig){const connection=override?null:await db.stockSheetsConnection.findUnique({where:{id:'active'}});if(!override&&!connection)throw new Error('STOCK_NOT_CONNECTED');const config=override??stockConnectionConfig.parse(decryptGmail(connection!.encryptedConfig));let token:string;
 if(config.type==='workload_identity'){const cached=connection?cache.get(connection.revision):null;if(cached&&cached.expires>Date.now()+60000)token=cached.token;else{const result=await federatedStockToken(config);token=result.token;if(connection){cache.clear();cache.set(connection.revision,result);}}}else token=await accessToken(config,connection?.revision);
 return async(path:string,init:RequestInit={})=>{const response=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+STOCK_SHEET_ID+path,{...init,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok){if(connection&&response.status===401)cache.delete(connection.revision);const error=await response.json().catch(()=>null);const disabled=Array.isArray(error?.error?.details)&&error.error.details.some((d:{reason?:string})=>d.reason==='SERVICE_DISABLED');throw new Error(disabled?'STOCK_SHEETS_API_DISABLED':response.status===403?'STOCK_SHEET_PERMISSION_DENIED':'STOCK_SHEET_REQUEST_FAILED');}return response.json();};
}
type GoogleClient=Awaited<ReturnType<typeof stockGoogleClient>>;
export async function readStockSheet(client?:GoogleClient){const request=client??await stockGoogleClient();const metadata=await request('?fields=sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))');const tab=latestStockTab(metadata.sheets.map((s:{properties:Parameters<typeof latestStockTab>[0][number]})=>s.properties));const limit=tab.gridProperties?.rowCount??1000;if(limit>10000)throw new Error('STOCK_SHEET_TOO_LARGE');const result=await request('/values/'+encodeURIComponent("'"+tab.title+"'!A1:Z"+limit)+'?valueRenderOption=UNFORMATTED_VALUE');const rows:unknown[][]=result.values??[];if(rows[0]?.[2]!=='รายการ'||rows[0]?.[4]!=='จำนวนรับ'||rows[0]?.[5]!=='จำนวนจ่าย'||rows[0]?.[6]!=='จำนวนคงเหลือ')throw new Error('STOCK_HEADERS_CHANGED');return {tab,rows,products:stockRows(rows,{costColumnConfirmed:true}),readAt:new Date()};}
export async function appendStockProduct(input:NewStockProduct,actor:string){
 return db.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','stock-sheet-add');
  const client=await stockGoogleClient();
  const audit=async(result:StockReceiptResult)=>{await tx.auditLog.upsert({where:{id:'stock-add:'+input.requestKey},create:{id:'stock-add:'+input.requestKey,actor,action:result.mode==='RECEIVED'?'STOCK_RECEIVED':'STOCK_PRODUCT_ADDED',entityId:input.code,details:{...result}},update:{}});};
  const metadata=await client('/developerMetadata:search',{method:'POST',body:JSON.stringify({dataFilters:[{developerMetadataLookup:{metadataKey:receiptKey(input.requestKey),visibility:'DOCUMENT'}}]})});
  const recovered=recoverReceipt(input,metadata);if(recovered){await audit(recovered);return {...recovered,replayed:true};}
  const before=await readStockSheet(client),existing=before.products.find(p=>p.code===input.code);let formula:string|undefined;
  if(existing){const cell=await client('/values/'+encodeURIComponent("'"+before.tab.title+"'!G"+existing.sourceRow)+'?valueRenderOption=FORMULA');const value=cell.values?.[0]?.[0];if(typeof value==='string'&&value.startsWith('='))formula=value;}
  const plan=stockReceiptPlan(input,before,formula);
  await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:plan.requests})});
  const after=await readStockSheet(client),written=after.products.find(p=>p.code===input.code);
  if(!written||written.receivedQuantity!==plan.result.receivedAfter||written.remainingQuantity!==plan.result.remainingAfter||written.name!==plan.result.nameAfter)throw new Error('STOCK_WRITE_NOT_CONFIRMED');
  await audit(plan.result);return {...plan.result,replayed:false};
 },{timeout:55000,maxWait:10000});
}
