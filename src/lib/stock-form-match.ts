import type {StockRow} from './stock-import';
import {compareStockCodes} from './stock-sort';
export type StockFormProduct=Pick<StockRow,'code'|'name'|'costSatang'|'receivedQuantity'|'issuedQuantity'|'remainingQuantity'|'salePrices'|'completedQuantity'|'precountedPendingQuantity'|'unverifiedPendingQuantity'>;
export function matchStockProduct(code:string,products:StockFormProduct[]){const key=code.trim().normalize('NFKC').toUpperCase();return products.find(product=>product.code.trim().normalize('NFKC').toUpperCase()===key)??null;}
export function suggestStockProducts(code:string,products:StockFormProduct[],limit=10){const key=code.trim().normalize('NFKC').toUpperCase();if(!key)return [];return products.filter(p=>p.code.normalize('NFKC').toUpperCase().includes(key)).sort((a,b)=>Number(!a.code.toUpperCase().startsWith(key))-Number(!b.code.toUpperCase().startsWith(key))||compareStockCodes(a.code,b.code)).slice(0,limit);}
