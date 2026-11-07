import {stockAvailableQuantity} from './stock-available';
export const stockSafetyReserveGrams=20;
type StockBalance=Parameters<typeof stockAvailableQuantity>[0];
// This is a selling limit only; never remove safety stock from physical inventory.
export function stockSellableQuantity(product:StockBalance,queuedMilliG=0){
 const available=stockAvailableQuantity(product);
 if(available===null)return null;
 return Math.max(0,(Math.round(available*1000)-queuedMilliG-stockSafetyReserveGrams*1000)/1000);
}
