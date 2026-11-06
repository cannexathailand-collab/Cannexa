const collator=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
const normalized=(code:string)=>code.trim().normalize('NFKC').toUpperCase();

export function compareStockCodes(a:string,b:string){
 const left=normalized(a),right=normalized(b);
 return collator.compare(left,right)||left.length-right.length||(left<right?-1:left>right?1:0);
}

export type StockSortSource={tab:{sheetId:number;title:string;gridProperties?:{columnCount?:number}};rows:readonly (readonly unknown[])[];products:readonly {code:string;sourceRow:number}[]};

// The caller submits these requests in one batch with its stock mutation and
// retry marker. Only a newly appended column is written, then removed again.
export function stockNaturalSortRequests(source:StockSortSource,additionalCode?:string):Record<string,unknown>[]{
 const {sheetId}=source.tab,columnCount=source.tab.gridProperties?.columnCount;
 if(!Number.isSafeInteger(sheetId)||sheetId<0||source.rows.length<2)throw Error('STOCK_SORT_INVALID_BOUNDS');
 if(columnCount!==undefined&&(!Number.isSafeInteger(columnCount)||columnCount<3||columnCount>18278||source.rows.some(row=>row.length>columnCount)))throw Error('STOCK_SORT_INVALID_BOUNDS');
 const products=source.products.map(p=>({...p,code:normalized(p.code)})),codes=new Set<string>(),occupied=new Set<number>();
 for(const product of products){
  const {code,sourceRow}=product;
  if(!code||codes.has(code))throw Error('STOCK_SORT_DUPLICATE_CODE');
  if(!Number.isSafeInteger(sourceRow)||sourceRow<3||sourceRow>source.rows.length||occupied.has(sourceRow))throw Error('STOCK_SORT_INVALID_BOUNDS');
  if(normalized(String(source.rows[sourceRow-1][2]??''))!==code)throw Error('STOCK_SORT_ROW_CHANGED');
  codes.add(code);occupied.add(sourceRow);
 }
 for(let row=3;row<=source.rows.length;row++)if(!occupied.has(row)&&String(source.rows[row-1][2]??'').trim())throw Error('STOCK_SORT_PRODUCT_MISSING');
 const endRowIndex=source.rows.length+(additionalCode===undefined?0:1);
 if(additionalCode!==undefined){
  const code=normalized(additionalCode);
  if(!code||codes.has(code))throw Error('STOCK_SORT_DUPLICATE_CODE');
  products.push({code,sourceRow:endRowIndex});occupied.add(endRowIndex);
 }
 const order=products.sort((a,b)=>compareStockCodes(a.code,b.code)).map(p=>p.sourceRow);
 // Keep every nonproduct row, including notes, in its original relative order.
 for(let row=3;row<=endRowIndex;row++)if(!occupied.has(row))order.push(row);
 if(order.every((row,index)=>row===index+3))return [];
 if(columnCount===undefined)throw Error('STOCK_SORT_COLUMN_COUNT_REQUIRED');
 if(columnCount===18278)throw Error('STOCK_SORT_INVALID_BOUNDS');
 const ranks=new Map(order.map((row,index)=>[row,index+1]));
 return [
  {appendDimension:{sheetId,dimension:'COLUMNS',length:1}},
  {updateCells:{start:{sheetId,rowIndex:2,columnIndex:columnCount},rows:Array.from({length:endRowIndex-2},(_,index)=>({values:[{userEnteredValue:{numberValue:ranks.get(index+3)!}}]})),fields:'userEnteredValue'}},
  {sortRange:{range:{sheetId,startRowIndex:2,endRowIndex,startColumnIndex:0,endColumnIndex:columnCount+1},sortSpecs:[{dimensionIndex:columnCount,sortOrder:'ASCENDING'}]}},
  {deleteDimension:{range:{sheetId,dimension:'COLUMNS',startIndex:columnCount,endIndex:columnCount+1}}}
 ];
}
