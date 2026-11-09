import {orderStockItems} from './order-stock-items';

export function orderProductCost(rawText:string|null,recordedCost:number|null,unitCosts:Map<string,number|null>){
 if(recordedCost!==null)return {amountSatang:recordedCost,estimated:false};
 const parsed=orderStockItems(rawText);
 if(parsed.issues.length)return {amountSatang:null,estimated:true};
 let total=0;
 for(const item of parsed.items){
  const cost=unitCosts.get(item.code);
  if(cost===undefined||cost===null||!Number.isSafeInteger(cost)||cost<0)return {amountSatang:null,estimated:true};
  total+=Number((BigInt(cost)*BigInt(item.quantityMilliG)+500n)/1000n);
 }
 return {amountSatang:total,estimated:true};
}
