import {randomUUID} from 'node:crypto';
import {db,transaction} from './db';
import {stockServiceConfig,readStockSheet,stockGoogleClient} from './stock-google';
import {activateStockWorkbook} from './stock-workbook-sync';
import {encryptGmail} from './gmail';
import {activateStockFlow} from './stock-flow';

export async function activateShopStock(actor:string){
 await activateStockWorkbook(actor);
 await activateStockFlow(actor);
 await transaction(async tx=>{
  const workflow=await tx.stockWorkflow.findUniqueOrThrow({where:{id:'active'}});
  await tx.stockIntegrationConfig.upsert({where:{id:'active'},create:{id:'active',enabled:true,activeFrom:workflow.activeFrom},update:{enabled:true}});
 });
}

export async function connectShopStock(form:FormData,actor:string){
 const spreadsheetId=String(form.get('spreadsheetId')??'').trim();
 if(!/^[-\w]{20,200}$/.test(spreadsheetId))throw Error('STOCK_SPREADSHEET_REQUIRED');
 const file=form.get('credentials');
 if(!(file instanceof File)||file.size<100||file.size>30000)throw Error('INVALID_STOCK_KEY');
 const config=stockServiceConfig.parse(JSON.parse(await file.text()));
 const previous=await db.stockSheetsConnection.findUnique({where:{id:'active'}});
 if(previous?.systemPrimary&&previous.spreadsheetId!==spreadsheetId)throw Error('STOCK_ALREADY_INITIALIZED');
 await readStockSheet(await stockGoogleClient(config,spreadsheetId));
 await transaction(async tx=>{
  const current=await tx.stockSheetsConnection.findUnique({where:{id:'active'}});
  if(current?.revision!==previous?.revision)throw Error('STOCK_SETTINGS_CHANGED');
  const data={spreadsheetId,email:config.client_email,encryptedConfig:encryptGmail(config),revision:randomUUID(),connectedAt:new Date()};
  await tx.stockSheetsConnection.upsert({where:{id:'active'},create:{id:'active',...data},update:data});
  await tx.auditLog.create({data:{actor,action:'STOCK_SHEETS_CONNECTED',entityId:'stock-sheet',details:{spreadsheetId,email:config.client_email}}});
 });
 await activateShopStock(actor);
}
