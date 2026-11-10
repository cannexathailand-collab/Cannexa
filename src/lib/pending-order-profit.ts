import {orderProductCost} from './order-product-cost';

type OrderHistory={
 order:{id:string;payment:string|null;rawText:string|null};
 excluded:boolean;recognized:boolean;amountSatang:number|null;productCostSatang:number|null;
};

export function pendingOrderProfit(history:OrderHistory[],unitCosts:Map<string,number|null>,payment:'COD'|'โอน'='COD'){
 const orders=[...new Map(history.map(row=>[row.order.id,row])).values()]
  .filter(row=>row.order.payment===payment&&!row.excluded&&!row.recognized);
 let revenueSatang=0,knownCostSatang=0,knownProfitSatang=0,missingCount=0,estimatedCostCount=0;
 for(const row of orders){
  const cost=orderProductCost(row.order.rawText,row.productCostSatang,unitCosts);
  revenueSatang+=row.amountSatang??0;
  knownCostSatang+=cost.amountSatang??0;
  if(cost.estimated)estimatedCostCount++;
  if(row.amountSatang===null||cost.amountSatang===null){missingCount++;continue;}
  knownProfitSatang+=row.amountSatang-cost.amountSatang;
 }
 return {count:orders.length,revenueSatang,knownCostSatang,knownProfitSatang,missingCount,estimatedCostCount,profitSatang:missingCount?null:knownProfitSatang};
}
