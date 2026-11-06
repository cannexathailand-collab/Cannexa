import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {shipmentArchive,saveShipmentArchive} from '../src/lib/stock-shipment-archive';
import type {StockOutSnapshot} from '../src/lib/stock-dispatch-plan';

const savedAt=new Date('2026-11-06T07:00:00Z');
const snapshot=(orderId='legacy',balances=false):StockOutSnapshot=>({
 orderId,orderNumber:'ORD-'+orderId,tracking:'TRACK-'+orderId,payment:'โอน',dispatchedAt:'2026-11-06T06:00:00.000Z',sourceSheet:'6.11.69',processedAt:savedAt.toISOString(),totalCostSatang:75000,
 items:[{code:'CG2',name:'Example',quantityMilliG:500000,unitCostSatang:150,costSatang:75000,issuedBefore:500,issuedAfter:0,remainingBefore:446,remainingAfter:-54,...(balances?{receivedBefore:446,receivedAfter:-54,completedBefore:0,completedAfter:0}:{})}]
});
const legacyRows=(s:StockOutSnapshot)=>s.items.map(i=>[
 savedAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}),new Date(s.dispatchedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}),s.orderNumber,s.tracking,i.code,i.name??'',i.quantityMilliG/1000,i.unitCostSatang/100,i.costSatang/100,s.orderId
]);
type Sheet={properties:{sheetId:number;title:string;gridProperties:{columnCount:number}};rows:(string|number)[][]};
function harness(existing?:StockOutSnapshot){
 const original=existing?shipmentArchive(existing,savedAt):null;
 const state={sheet:original?{properties:{sheetId:original.sheetId,title:original.title,gridProperties:{columnCount:10}},rows:[Array.from({length:10},(_,i)=>'Header '+i),...structuredClone(original.rows)]} as Sheet:null as Sheet|null,markers:new Map<string,any>(),batches:[] as any[][],reads:[] as string[],loseAppend:false};
 if(original)state.markers.set(original.key,{metadataKey:original.key,metadataValue:original.fingerprint,location:{sheetId:original.sheetId}});
 const client=async(path:string,init?:RequestInit):Promise<any>=>{
  if(path.startsWith('?'))return {sheets:state.sheet?[{properties:structuredClone(state.sheet.properties)}]:[]};
  if(path==='/developerMetadata:search'){
   const key=JSON.parse(String(init?.body)).dataFilters[0].developerMetadataLookup.metadataKey;
   return {matchedDeveloperMetadata:state.markers.has(key)?[{developerMetadata:state.markers.get(key)}]:[]};
  }
  if(path===':batchUpdate'){
   const requests=JSON.parse(String(init?.body)).requests;state.batches.push(requests);
   for(const request of requests){
    if(request.addSheet){assert.equal(state.sheet,null);state.sheet={properties:request.addSheet.properties,rows:[]};}
    if(request.updateSheetProperties){assert.ok(state.sheet);assert.equal(request.updateSheetProperties.properties.sheetId,state.sheet.properties.sheetId);state.sheet.properties.gridProperties.columnCount=request.updateSheetProperties.properties.gridProperties.columnCount;}
    if(request.updateCells){
     assert.ok(state.sheet);const {start,rows}=request.updateCells;assert.equal(start.sheetId,state.sheet.properties.sheetId);
     for(const [ri,row] of rows.entries()){
      assert.ok(start.columnIndex+row.values.length<=state.sheet.properties.gridProperties.columnCount);
      const output=state.sheet.rows[start.rowIndex+ri]??=[];
      row.values.forEach((cell:any,ci:number)=>{output[start.columnIndex+ci]=cell.userEnteredValue?.numberValue??cell.userEnteredValue?.stringValue??'';});
     }
    }
    if(request.appendCells){
     assert.ok(state.sheet);assert.equal(request.appendCells.sheetId,state.sheet.properties.sheetId);
     for(const row of request.appendCells.rows){assert.ok(row.values.length<=state.sheet.properties.gridProperties.columnCount);state.sheet.rows.push(row.values.map((cell:any)=>cell.userEnteredValue.numberValue??cell.userEnteredValue.stringValue));}
    }
    if(request.createDeveloperMetadata){const marker=request.createDeveloperMetadata.developerMetadata;state.markers.set(marker.metadataKey,marker);}
   }
   if(state.loseAppend&&requests.some((r:any)=>r.appendCells)){state.loseAppend=false;throw Error('Lost archive response');}
   return {};
  }
  if(path.startsWith('/values/')){
   assert.ok(state.sheet);const range=decodeURIComponent(path.slice('/values/'.length).split('?')[0]);state.reads.push(range);
   assert.ok(range.startsWith("'"+state.sheet.properties.title+"'!A:"));
   const width=range.endsWith(':N')?14:range.endsWith(':J')?10:0;assert.ok(width);
   return {values:state.sheet.rows.map(row=>row.slice(0,width))};
  }
  throw Error('Unexpected archive request '+path);
 };
 return {state,client};
}

test('legacy snapshot rows and fingerprints stay byte-for-byte compatible',()=>{
 const s=snapshot(),archive=shipmentArchive(s,savedAt),rows=legacyRows(s);
 assert.deepEqual(archive.rows,rows);assert.equal(archive.columnCount,10);
 assert.equal(archive.fingerprint,createHash('sha256').update(JSON.stringify(rows)).digest('hex'));
 assert.equal(archive.key,'stock-shipment-'+createHash('sha256').update(s.orderId).digest('hex').slice(0,32));
});

test('new snapshot carries signed and zero as-of balances without converting missing legacy fields',()=>{
 const s=snapshot('new',true);s.items.push({...s.items[0],code:'ZERO',receivedBefore:0,receivedAfter:0,remainingBefore:0,remainingAfter:0});
 s.items.push({...snapshot().items[0],code:'OLD'});
 const archive=shipmentArchive(s,savedAt);assert.equal(archive.columnCount,14);
 assert.deepEqual(archive.rows[0].slice(10),[446,-54,446,-54]);
 assert.deepEqual(archive.rows[1].slice(10),[0,0,0,0]);
 assert.deepEqual(archive.rows[2].slice(10),['','',446,-54]);
 s.items[0].receivedBefore=999;s.items[0].receivedAfter=999;
 assert.deepEqual(archive.rows[0].slice(10),[446,-54,446,-54]);
});

test('new archive tabs have fourteen columns while legacy entries still verify only A:J',async()=>{
 const h=harness(),s=snapshot();await saveShipmentArchive(h.client,s,savedAt);
 assert.equal(h.state.sheet?.properties.gridProperties.columnCount,14);
 assert.equal(h.state.sheet?.rows[0].length,14);assert.match(String(h.state.sheet?.rows[0][11]),/คำนวณ/);
 assert.deepEqual(h.state.sheet?.rows[1],legacyRows(s)[0]);assert.match(h.state.reads[0],/!A:J$/);
});

test('existing ten-column archives expand only for new balances and keep old rows and markers unchanged',async()=>{
 const old=snapshot(),oldArchive=shipmentArchive(old,savedAt),h=harness(old);
 await saveShipmentArchive(h.client,old,savedAt);assert.equal(h.state.batches.length,0);assert.equal(h.state.sheet?.properties.gridProperties.columnCount,10);
 const next=snapshot('new',true);await saveShipmentArchive(h.client,next,savedAt);
 assert.equal(h.state.sheet?.properties.gridProperties.columnCount,14);assert.deepEqual(h.state.sheet?.rows[1],legacyRows(old)[0]);
 assert.deepEqual(h.state.sheet?.rows[2].slice(10),[446,-54,446,-54]);assert.match(h.state.reads.at(-1)!,/!A:N$/);
 assert.equal(h.state.markers.get(oldArchive.key).metadataValue,oldArchive.fingerprint);
 const writes=h.state.batches.length;await saveShipmentArchive(h.client,old,savedAt);await saveShipmentArchive(h.client,next,savedAt);
 assert.equal(h.state.batches.length,writes);assert.equal(h.state.sheet?.rows.length,3);
 const extension=h.state.batches.flat().find(r=>r.updateCells)?.updateCells;
 assert.equal(extension.start.rowIndex,0);assert.equal(extension.start.columnIndex,10);
});

test('lost archive response replays saved balances once and rejects changed values',async()=>{
 const h=harness(),s=snapshot('new',true);h.state.loseAppend=true;
 await assert.rejects(()=>saveShipmentArchive(h.client,s,savedAt),/Lost archive response/);
 const writes=h.state.batches.length;await saveShipmentArchive(h.client,structuredClone(s),savedAt);
 assert.equal(h.state.batches.length,writes);assert.equal(h.state.sheet?.rows.length,2);
 assert.deepEqual(h.state.sheet?.rows[1].slice(10),[446,-54,446,-54]);
 const changed=structuredClone(s);changed.items[0].receivedBefore=999;
 await assert.rejects(()=>saveShipmentArchive(h.client,changed,savedAt),/STOCK_HISTORY_CONFLICT/);
 assert.equal(h.state.batches.length,writes);
});

test('verification includes new balance columns even when the archive marker is present',async()=>{
 const h=harness(),s=snapshot('new',true);await saveShipmentArchive(h.client,s,savedAt);
 h.state.sheet!.rows[1][11]=999;
 await assert.rejects(()=>saveShipmentArchive(h.client,s,savedAt),/STOCK_HISTORY_NOT_CONFIRMED/);
 assert.equal(h.state.sheet?.rows.length,2);
});
