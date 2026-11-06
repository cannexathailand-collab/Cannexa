import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareStockCodes,stockNaturalSortRequests,type StockSortSource} from '../src/lib/stock-sort';

function source(codes:(string|null)[],columnCount=32):StockSortSource{
 const rows:unknown[][]=[['Header'],['Sizes'],...codes.map((code,index)=>Array.from({length:columnCount},(_,column)=>column===2?code:column===6?'=INDEX(E:E,ROW())-INDEX(M:M,ROW())':column===13?'=INDEX(G:G,ROW())-INDEX(F:F,ROW())+N(INDEX(O:O,ROW()))':`${index}:${column}`))];
 return {tab:{sheetId:5,title:'6.11.69',gridProperties:{columnCount}},rows,products:codes.flatMap((code,index)=>code===null?[]:[{code,sourceRow:index+3}])};
}

test('stock codes sort by numeric value with deterministic leading-zero and accent ties',()=>{
 const codes=['CG13','CG2','CG1','CG10','CG02','CG001','CG0002','AB10','AB2'];
 assert.deepEqual(codes.sort(compareStockCodes),['AB2','AB10','CG1','CG001','CG2','CG02','CG0002','CG10','CG13']);
 assert.equal(compareStockCodes('ｃｇ２','CG2'),0);
 assert.equal(compareStockCodes(' \tｃｇ２\n','CG2'),0);
 assert.ok(compareStockCodes('E2','É2')<0);
 assert.ok(compareStockCodes('X999999999999999999999','X1000000000000000000000')<0);
});

test('natural sorting moves whole rows, formulas, formatting, helpers and columns beyond Z together',()=>{
 const s=source(['CG13',null,'CG2','CG1',null]);
 const original=s.rows.map(row=>Array.from({length:32},(_,column)=>({value:row[column]??'',format:'style-'+column,note:'note-'+String(row[2]??'')})));
 const rows=structuredClone(original),requests=stockNaturalSortRequests(s) as any[];let width=32;
 assert.equal(requests.length,4);
 for(const request of requests){
  if(request.appendDimension){assert.equal(request.appendDimension.dimension,'COLUMNS');assert.equal(request.appendDimension.length,1);width++;for(const row of rows)row.push({value:'',format:'temporary',note:''});}
  if(request.updateCells){const {start}=request.updateCells;assert.equal(start.columnIndex,32);for(const [index,row] of request.updateCells.rows.entries())rows[start.rowIndex+index][start.columnIndex].value=row.values[0].userEnteredValue.numberValue;}
  if(request.sortRange){const {range,sortSpecs}=request.sortRange;assert.equal(range.startRowIndex,2);assert.equal(range.startColumnIndex,0);assert.equal(range.endColumnIndex,width);const body=rows.slice(range.startRowIndex,range.endRowIndex).sort((a,b)=>Number(a[sortSpecs[0].dimensionIndex].value)-Number(b[sortSpecs[0].dimensionIndex].value));rows.splice(range.startRowIndex,body.length,...body);}
  if(request.deleteDimension){const {range}=request.deleteDimension;assert.equal(range.startIndex,32);assert.equal(range.endIndex,33);for(const row of rows)row.splice(range.startIndex,1);width--;}
 }
 assert.equal(width,32);assert.deepEqual(rows.slice(0,2),original.slice(0,2));
 assert.deepEqual(rows.slice(2),[original[5],original[4],original[2],original[3],original[6]]);
 assert.deepEqual(s.rows,source(['CG13',null,'CG2','CG1',null]).rows);
});

test('new appended product receives its own numeric rank ahead of existing nonproduct rows',()=>{
 const s=source(['CG2','CG13',null]),requests=stockNaturalSortRequests(s,'CG3') as any[];
 const ranking=requests.find(r=>r.updateCells).updateCells;
 assert.deepEqual(ranking.rows.map((r:any)=>r.values[0].userEnteredValue.numberValue),[1,3,4,2]);
 const sort=requests.find(r=>r.sortRange).sortRange;
 assert.equal(sort.range.endRowIndex,s.rows.length+1);assert.equal(sort.sortSpecs[0].dimensionIndex,32);
});

test('raw sheet whitespace matches imported normalized codes when planning natural sort',()=>{
 const s=source([' CG13 ','\tｃｇ２\n','CG1']);
 const imported={...s,products:s.products.map(p=>({...p,code:p.code.trim().normalize('NFKC').toUpperCase()}))};
 const requests=stockNaturalSortRequests(imported) as any[];
 const ranking=requests.find(r=>r.updateCells).updateCells;
 assert.deepEqual(ranking.rows.map((r:any)=>r.values[0].userEnteredValue.numberValue),[3,2,1]);
 assert.throws(()=>stockNaturalSortRequests(imported,' CG2 '),/DUPLICATE_CODE/);
});

test('already natural order avoids temporary columns and does not require guessed grid dimensions',()=>{
 const s=source(['CG1','CG2','CG13']);delete s.tab.gridProperties;
 assert.deepEqual(stockNaturalSortRequests(s),[]);assert.deepEqual(stockNaturalSortRequests(s,'CG14'),[]);
 assert.throws(()=>stockNaturalSortRequests(s,'CG3'),/COLUMN_COUNT_REQUIRED/);
 assert.deepEqual(stockNaturalSortRequests(source([])),[]);
});

test('sort plan rejects duplicate codes, stale row mapping, incomplete products and unsafe bounds',()=>{
 assert.throws(()=>stockNaturalSortRequests(source(['CG2','ｃｇ２'])),/DUPLICATE_CODE/);
 assert.throws(()=>stockNaturalSortRequests(source(['CG2']),'ｃｇ２'),/DUPLICATE_CODE/);
 const s=source(['CG13','CG2']);
 assert.throws(()=>stockNaturalSortRequests({...s,products:[{code:'CG13',sourceRow:2},s.products[1]]}),/INVALID_BOUNDS/);
 assert.throws(()=>stockNaturalSortRequests({...s,products:[{code:'CG13',sourceRow:99},s.products[1]]}),/INVALID_BOUNDS/);
 assert.throws(()=>stockNaturalSortRequests({...s,products:[{code:'CG13',sourceRow:3},{code:'CG2',sourceRow:3}]}),/INVALID_BOUNDS/);
 assert.throws(()=>stockNaturalSortRequests({...s,products:[{code:'CG1',sourceRow:3},s.products[1]]}),/ROW_CHANGED/);
 assert.throws(()=>stockNaturalSortRequests({...s,products:[s.products[0]]}),/PRODUCT_MISSING/);
 assert.throws(()=>stockNaturalSortRequests({...s,tab:{...s.tab,gridProperties:{columnCount:26}}}),/INVALID_BOUNDS/);
 assert.throws(()=>stockNaturalSortRequests({...s,tab:{...s.tab,gridProperties:{columnCount:18278}}}),/INVALID_BOUNDS/);
 assert.throws(()=>stockNaturalSortRequests({...s,tab:{...s.tab,sheetId:-1}}),/INVALID_BOUNDS/);
});
