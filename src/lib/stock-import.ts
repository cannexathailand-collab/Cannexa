import {STOCK_PRECOUNTED_HEADER,STOCK_UNVERIFIED_HEADER} from './stock-available';
import {stockCode} from './stock-code';
import {STOCK_COMPLETED_HEADER} from './stock-flow-plan';
export type StockPrice={pack:string;priceSatang:number};
export type StockRow={code:string;name:string|null;costSatang:number|null;receivedQuantity:number|null;issuedQuantity:number|null;remainingQuantity:number|null;completedQuantity?:number|null;precountedPendingQuantity?:number|null;unverifiedPendingQuantity?:number|null;salePrices:StockPrice[];sourceRow:number};
function quantity(raw:unknown,code:string){if(raw===null||raw===undefined||raw==='')return null;const n=typeof raw==='number'?raw:Number(String(raw).replace(/,/g,''));if(!Number.isFinite(n)||Math.abs(n*1000-Math.round(n*1000))>0.0001||Math.abs(n)>=1e15)throw new Error('INVALID_PRODUCT_QUANTITY '+code);return n;}
export function stockPrices(row:unknown[],headers:unknown[]):StockPrice[]{return row.slice(8,12).flatMap((raw,index)=>{if(raw===null||raw===undefined||raw==='')return [];const explicit=typeof raw==='string'?raw.trim().match(/^([^/]+)\s*\/\s*([\d,.]+)$/):null;const pack=explicit?explicit[1].trim():String(headers[index+8]??'').trim();const price=Number(String(explicit?explicit[2]:raw).replace(/,/g,''));if(!pack||!Number.isFinite(price)||price<0||!Number.isSafeInteger(Math.round(price*100))||Math.abs(price*100-Math.round(price*100))>0.00001)throw new Error('INVALID_PRODUCT_PRICE');return [{pack,priceSatang:Math.round(price*100)}];});}
export function stockRows(rows:unknown[][],{costColumnConfirmed=false}:{costColumnConfirmed?:boolean}={}):StockRow[]{
 const seen=new Set<string>();const products:StockRow[]=[];
 rows.forEach((row,index)=>{
  if(index<2)return;
  const raw=row[2];if(raw===null||raw===undefined||String(raw).trim()==='')return;
  const parsedCode=stockCode.safeParse(String(raw));if(!parsedCode.success)throw new Error('INVALID_PRODUCT_CODE row '+(index+1));const code=parsedCode.data;
  if(seen.has(code))throw new Error('DUPLICATE_PRODUCT_CODE '+code);seen.add(code);
  const name=typeof row[1]==='string'&&row[1].trim()?row[1].trim():null;
  const rawCost=row[3];let costSatang:number|null=null;
  if(costColumnConfirmed&&rawCost!==null&&rawCost!==undefined&&rawCost!==''){
   const n=typeof rawCost==='number'?rawCost:Number(String(rawCost).replace(/,/g,''));
   if(!Number.isFinite(n)||n<0||Math.abs(n*100-Math.round(n*100))>0.00001||!Number.isSafeInteger(Math.round(n*100)))throw new Error('INVALID_PRODUCT_COST '+code);
   costSatang=Math.round(n*100);
  }
  const rawQuantity=row[4];let receivedQuantity:number|null=null;
  if(rawQuantity!==null&&rawQuantity!==undefined&&rawQuantity!==''){
   const n=typeof rawQuantity==='number'?rawQuantity:Number(String(rawQuantity).replace(/,/g,''));
   if(!Number.isFinite(n)||Math.abs(n*1000-Math.round(n*1000))>0.0001||Math.abs(n)>=1e15)throw new Error('INVALID_PRODUCT_QUANTITY '+code);
   receivedQuantity=n;
  }
  products.push({code,name,costSatang,receivedQuantity,issuedQuantity:quantity(row[5],code),remainingQuantity:quantity(row[6],code),...(rows[0]?.[12]===STOCK_COMPLETED_HEADER?{completedQuantity:quantity(row[12]??0,code)}:{}),...(rows[0]?.[14]===STOCK_PRECOUNTED_HEADER?{precountedPendingQuantity:quantity(row[14]??0,code)}:{}),...(rows[0]?.[15]===STOCK_UNVERIFIED_HEADER?{unverifiedPendingQuantity:quantity(row[15]??0,code)}:{}),salePrices:stockPrices(row,rows[1]??[]),sourceRow:index+1});
 });return products;
}
