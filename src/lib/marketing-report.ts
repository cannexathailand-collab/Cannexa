import {db} from './db';
import {isRecognizedSale,salesReport,type SaleRow} from './sales-report';
import {bangkokDay,dayStart,shiftDay,salesRange,DAY_MS} from './sales-dates';

export const marketingWindowDays=30;
type MarketingClick={id:string;marketingCustomerCode:string|null;createdAt:Date;customerLanding:boolean;customerEnteredAt:Date|null};
type MarketingOrder={id:string;customerCode:string|null;orderNumber:string;eventAt:Date};

export function attributeMarketingSales(sales:SaleRow[],orders:MarketingOrder[],clicks:MarketingClick[]){
 const orderById=new Map(orders.map(order=>[order.id,order]));
 const touches=clicks.filter(click=>click.customerLanding&&click.marketingCustomerCode&&click.customerEnteredAt)
  .sort((a,b)=>+b.customerEnteredAt!-+a.customerEnteredAt!||+b.createdAt-+a.createdAt||a.id.localeCompare(b.id));
 const byCustomer=Map.groupBy(touches,click=>click.marketingCustomerCode!);
 const seen=new Set<string>();
 const attributed=[];
 for(const sale of sales.filter(isRecognizedSale)){
  if(seen.has(sale.orderId))continue;
  seen.add(sale.orderId);
  const order=orderById.get(sale.orderId);
  if(!order?.customerCode)continue;
  const click=byCustomer.get(order.customerCode)?.find(touch=>
   +touch.createdAt<=+touch.customerEnteredAt!&&+touch.customerEnteredAt!<=+order.eventAt&&+order.eventAt<+touch.createdAt+marketingWindowDays*DAY_MS);
  if(!click)continue;
  attributed.push({orderId:sale.orderId,orderNumber:order.orderNumber,customerCode:order.customerCode,revenueSatang:sale.revenueSatang,recognizedAt:sale.recognizedAt!,clickId:click.id,enteredAt:click.customerEnteredAt!});
 }
 return attributed;
}

export async function marketingReport(input:{from?:string;to?:string}={}){
 const today=bangkokDay(new Date());
 const range=salesRange({from:input.from??today,to:input.to??today});
 const [report,visits,entrances]=await Promise.all([
  salesReport(range),
  db.click.count({where:{customerLanding:true,createdAt:{gte:dayStart(range.from),lt:dayStart(shiftDay(range.to,1))}}}),
  db.click.findMany({where:{customerLanding:true,customerEnteredAt:{gte:dayStart(range.from),lt:dayStart(shiftDay(range.to,1))}},select:{marketingCustomerCode:true}}),
 ]);
 const orders=await db.orderIntake.findMany({where:{id:{in:report.summary.rows.map(sale=>sale.orderId)}},select:{id:true,customerCode:true,orderNumber:true,eventAt:true}});
 const times=orders.map(order=>+order.eventAt);
 const earliest=times.reduce((minimum,time)=>Math.min(minimum,time),Infinity);
 const latest=times.reduce((maximum,time)=>Math.max(maximum,time),-Infinity);
 const clicks=times.length?await db.click.findMany({
  where:{customerLanding:true,marketingCustomerCode:{in:[...new Set(orders.flatMap(order=>order.customerCode?[order.customerCode]:[]))]},createdAt:{gt:new Date(earliest-marketingWindowDays*DAY_MS),lte:new Date(latest)},customerEnteredAt:{lte:new Date(latest)}},
  select:{id:true,marketingCustomerCode:true,createdAt:true,customerLanding:true,customerEnteredAt:true},
 }):[];
 const attributed=attributeMarketingSales(report.summary.rows,orders,clicks);
 return {range,visits,customers:new Set(entrances.flatMap(entrance=>entrance.marketingCustomerCode?[entrance.marketingCustomerCode]:[])).size,orders:attributed,revenueSatang:attributed.reduce((total,order)=>total+order.revenueSatang,0)};
}
