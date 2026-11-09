import {stockPrices} from './stock-import';import {normalizeStockPackage} from './stock-product-input';
export type StockPriceColumn={columnIndex:number;pack:string;headerPack:string;priceSatang:number|null};
export function stockPriceColumns(row:unknown[],headers:unknown[]):StockPriceColumn[]{return [8,9,10,11].map(columnIndex=>{const one=Array(12).fill(null);one[columnIndex]=row[columnIndex];const price=stockPrices(one,headers)[0],headerPack=normalizeStockPackage(headers[columnIndex]);return {columnIndex,headerPack,pack:price?normalizeStockPackage(price.pack):headerPack,priceSatang:price?.priceSatang??null};});}
export function stockPriceCell(column:StockPriceColumn,priceSatang:number|null){return priceSatang===null?'':column.pack===column.headerPack?priceSatang/100:column.pack+'/'+(priceSatang/100);}
export function sortStockPackages(packs:string[]){
 const sizes=packs.map(pack=>{
  try{return {pack,grams:Number.parseFloat(normalizeStockPackage(pack))};}
  catch{return {pack,grams:Number.POSITIVE_INFINITY};}
 });
 return sizes.sort((a,b)=>a.grams-b.grams||a.pack.localeCompare(b.pack)).map(size=>size.pack);
}
