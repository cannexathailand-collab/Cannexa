import {randomUUID} from 'node:crypto';
import {stockRows} from './stock-import';
import {STOCK_COMPLETED_HEADER} from './stock-flow-plan';

export type WorkbookCell=string|number|boolean|null;
export type WorkbookSheet={properties:{sheetId:number;title:string;gridProperties:{rowCount:number;columnCount:number;[key:string]:unknown};[key:string]:unknown};rows:WorkbookCell[][];protectedRanges?:any[]};
export type WorkbookMetadata={metadataId?:number;metadataKey:string;metadataValue:string;location:{sheetId?:number;spreadsheet?:boolean};visibility?:string};
export type StockWorkbookState={activeSheetId:number;sheets:WorkbookSheet[];metadata:WorkbookMetadata[];pending:{id:string;requests:Record<string,any>[]}[]};

const empty=(value:unknown)=>value===undefined||value===null||value==='';
const numeric=(value:WorkbookCell|undefined)=>empty(value)?0:Number(value);
export function workbookSheet(state:StockWorkbookState,id:number){const sheet=state.sheets.find(s=>s.properties.sheetId===id);if(!sheet)throw Error('STOCK_SYSTEM_SHEET_NOT_FOUND');return sheet;}
export function workbookValue(sheet:WorkbookSheet,row:number,column:number):WorkbookCell{
 const value=sheet.rows[row]?.[column]??null;
 if(typeof value!=='string'||!value.startsWith('=')||![6,13].includes(column))return value;
 if(column===6){
  const received=sheet.rows[row]?.[4];if(empty(received))return '';
  const completed=sheet.rows[0]?.[12]===STOCK_COMPLETED_HEADER?sheet.rows[row]?.[12]:sheet.rows[row]?.[5];
  return Math.round((numeric(received)-numeric(completed))*1000)/1000;
 }
 if(column===13){
  const remaining=workbookValue(sheet,row,6);
  if(empty(remaining)||numeric(sheet.rows[row]?.[15])>0)return '';
  return Math.round((numeric(remaining)-numeric(sheet.rows[row]?.[5])+numeric(sheet.rows[row]?.[14]))*1000)/1000;
 }
 throw Error('STOCK_SYSTEM_UNSUPPORTED_FORMULA');
}
export function workbookValues(sheet:WorkbookSheet){return sheet.rows.map((row,i)=>row.map((_,j)=>workbookValue(sheet,i,j)));}
function columnNumber(value:string){let number=0;for(const letter of value)number=number*26+letter.charCodeAt(0)-64;return number-1;}
function rangeValues(state:StockWorkbookState,range:string,formulas:boolean){
 const parsed=/^(?:'((?:[^']|'')+)'|([^!]+))!([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/.exec(range);
 if(!parsed)throw Error('STOCK_SYSTEM_RANGE_INVALID');
 const title=(parsed[1]??parsed[2]).replace(/''/g,"'"),sheet=state.sheets.find(s=>s.properties.title===title);
 if(!sheet)throw Error('STOCK_SYSTEM_SHEET_NOT_FOUND');
 const firstColumn=columnNumber(parsed[3]),lastColumn=columnNumber(parsed[5]??parsed[3]);
 const firstRow=parsed[4]?Number(parsed[4])-1:0,lastRow=parsed[6]?Number(parsed[6]):parsed[5]?sheet.rows.length:firstRow+1;
 const values:WorkbookCell[][]=[];
 for(let i=firstRow;i<Math.min(lastRow,sheet.rows.length);i++){
  const row:WorkbookCell[]=[];
  for(let j=firstColumn;j<=lastColumn;j++)row.push(formulas?sheet.rows[i]?.[j]??null:workbookValue(sheet,i,j));
  while(row.length&&empty(row.at(-1)))row.pop();values.push(row);
 }
 while(values.length&&!values.at(-1)!.length)values.pop();return {range,values};
}
export function readWorkbook(state:StockWorkbookState,path:string,body?:any){
 const url=new URL(path,'https://stock.local');
 if(url.pathname==='/developerMetadata:search'){
  const keys=(body?.dataFilters??[]).map((filter:any)=>filter.developerMetadataLookup?.metadataKey);
  return {matchedDeveloperMetadata:state.metadata.filter(m=>keys.includes(m.metadataKey)).map(developerMetadata=>({developerMetadata}))};
 }
 if(url.pathname==='/values:batchGet')return {valueRanges:url.searchParams.getAll('ranges').map(range=>rangeValues(state,range,url.searchParams.get('valueRenderOption')==='FORMULA'))};
 if(url.pathname.startsWith('/values/'))return rangeValues(state,decodeURIComponent(url.pathname.slice('/values/'.length)),url.searchParams.get('valueRenderOption')==='FORMULA');
 if(url.pathname==='/')return {sheets:state.sheets.map(sheet=>({properties:sheet.properties,protectedRanges:sheet.protectedRanges??[],developerMetadata:state.metadata.filter(m=>m.location.sheetId===sheet.properties.sheetId)})),developerMetadata:state.metadata.filter(m=>m.location.spreadsheet)};
 throw Error('STOCK_SYSTEM_REQUEST_UNSUPPORTED');
}
function cellValue(cell:any):WorkbookCell{return cell.userEnteredValue?.numberValue??cell.userEnteredValue?.stringValue??cell.userEnteredValue?.formulaValue??cell.userEnteredValue?.boolValue??null;}
const presentationRequests=new Set(['repeatCell','updateDimensionProperties','setBasicFilter']);
export function applyWorkbookRequests(original:StockWorkbookState,requests:Record<string,any>[]){
 const state=structuredClone(original);
 for(const request of requests){
  if(request.addSheet){
   const properties=structuredClone(request.addSheet.properties);
   if(state.sheets.some(s=>s.properties.sheetId===properties.sheetId||s.properties.title===properties.title))throw Error('STOCK_SYSTEM_SHEET_EXISTS');
   state.sheets.push({properties:{...properties,gridProperties:{rowCount:1000,columnCount:26,...properties.gridProperties}},rows:[]});
  }else if(request.updateCells){
   const update=request.updateCells,start=update.start??{sheetId:update.range.sheetId,rowIndex:update.range.startRowIndex??0,columnIndex:update.range.startColumnIndex??0};
   const sheet=workbookSheet(state,start.sheetId);
   for(const [i,row] of (update.rows??[]).entries()){
    const index=(start.rowIndex??0)+i;sheet.rows[index]??=[];
    for(const [j,cell] of (row.values??[]).entries())sheet.rows[index][(start.columnIndex??0)+j]=cellValue(cell);
   }
   sheet.properties.gridProperties.rowCount=Math.max(sheet.properties.gridProperties.rowCount,sheet.rows.length);
  }else if(request.appendCells){const append=request.appendCells,sheet=workbookSheet(state,append.sheetId);sheet.rows.push(...append.rows.map((row:any)=>row.values.map(cellValue)));sheet.properties.gridProperties.rowCount=Math.max(sheet.properties.gridProperties.rowCount,sheet.rows.length);
  }else if(request.appendDimension){const value=request.appendDimension;const sheet=workbookSheet(state,value.sheetId);const key=value.dimension==='COLUMNS'?'columnCount':'rowCount';sheet.properties.gridProperties[key]+=value.length;
  }else if(request.deleteDimension){
   const range=request.deleteDimension.range,sheet=workbookSheet(state,range.sheetId),count=range.endIndex-range.startIndex;
   if(range.dimension==='ROWS'){sheet.rows.splice(range.startIndex,count);sheet.properties.gridProperties.rowCount-=count;}
   else{for(const row of sheet.rows)row.splice(range.startIndex,count);sheet.properties.gridProperties.columnCount-=count;}
  }else if(request.sortRange){
   const {range,sortSpecs}=request.sortRange,sheet=workbookSheet(state,range.sheetId);
   const rows=sheet.rows.slice(range.startRowIndex,range.endRowIndex);
   rows.sort((left,right)=>{for(const spec of sortSpecs){const a=left[spec.dimensionIndex],b=right[spec.dimensionIndex];const compared=typeof a==='number'&&typeof b==='number'?a-b:String(a??'').localeCompare(String(b??''));if(compared)return spec.sortOrder==='DESCENDING'?-compared:compared;}return 0;});
   sheet.rows.splice(range.startRowIndex,rows.length,...rows);
  }else if(request.updateSheetProperties){
   const properties=request.updateSheetProperties.properties,sheet=workbookSheet(state,properties.sheetId);
   sheet.properties={...sheet.properties,...properties,gridProperties:{...sheet.properties.gridProperties,...properties.gridProperties}};
  }else if(request.createDeveloperMetadata){state.metadata.push({...request.createDeveloperMetadata.developerMetadata,metadataId:Math.max(0,...state.metadata.map(m=>m.metadataId??0))+1});
  }else if(request.deleteDeveloperMetadata){const lookup=request.deleteDeveloperMetadata.dataFilter.developerMetadataLookup;state.metadata=state.metadata.filter(m=>lookup.metadataKey?m.metadataKey!==lookup.metadataKey:m.metadataId!==lookup.metadataId);
  }else if(request.addProtectedRange){const protection=request.addProtectedRange.protectedRange,sheet=workbookSheet(state,protection.range.sheetId);sheet.protectedRanges??=[];sheet.protectedRanges.push({...protection,protectedRangeId:Math.max(0,...state.sheets.flatMap(s=>(s.protectedRanges??[]).map(p=>p.protectedRangeId??0)))+1});
  }else if(request.updateProtectedRange){const protection=request.updateProtectedRange.protectedRange,sheet=workbookSheet(state,protection.range.sheetId);sheet.protectedRanges=(sheet.protectedRanges??[]).map(p=>p.protectedRangeId===protection.protectedRangeId?protection:p);
  }else if(!Object.keys(request).every(key=>presentationRequests.has(key)))throw Error('STOCK_SYSTEM_MUTATION_UNSUPPORTED');
 }
 const primary=workbookSheet(state,state.activeSheetId);
 stockRows(workbookValues(primary),{costColumnConfirmed:true});
 state.pending.push({id:randomUUID(),requests});return state;
}
