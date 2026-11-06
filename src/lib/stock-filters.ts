import {stockAvailableQuantity} from './stock-available';
export const stockFilterLabels={all:'ทั้งหมด',cost_missing:'ต้นทุนว่าง',name_missing:'ยังไม่มีชื่อ',out_of_stock:'สินค้าหมด'} as const;
export type StockFilter=keyof typeof stockFilterLabels;
export function stockFilter(raw?:string):StockFilter{return raw&&Object.hasOwn(stockFilterLabels,raw)?raw as StockFilter:'all';}
export function filterStockProducts<T extends {code:string;name:string|null;costSatang:number|null;remainingQuantity:number|null;issuedQuantity?:number|null;completedQuantity?:number|null}>(products:T[],query:string,filter:StockFilter){const key=query.trim().normalize('NFKC').toUpperCase();return products.filter(p=>(!key||(p.code+' '+(p.name??'')).normalize('NFKC').toUpperCase().includes(key))&&(filter==='all'||filter==='cost_missing'&&p.costSatang===null||filter==='name_missing'&&!p.name?.trim()||filter==='out_of_stock'&&stockAvailableQuantity(p)!==null&&stockAvailableQuantity(p)!<=0));}
