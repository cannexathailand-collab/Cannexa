import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Prisma} from '@prisma/client';
import {db,transaction,userLock} from './db';
import {stockCode} from './stock-code';
import {orderStockItems} from './order-stock-items';
import {isRecognizedSale} from './sales-report';

const productsSchema=z.array(z.object({code:stockCode,category:z.string().trim().max(80),recommended:z.boolean()})).max(2000).refine(rows=>new Set(rows.map(row=>row.code)).size===rows.length);
export type ShopCatalogProductSetting=z.infer<typeof productsSchema>[number];
export async function loadShopCatalogSettings(client:Prisma.TransactionClient=db){
 const row=await client.shopCatalogSettings.findUnique({where:{id:'active'}});
 const parsed=productsSchema.safeParse(row?.products??[]);
 return {products:parsed.success?parsed.data:[],version:row?.version??''};
}
export async function saveShopCatalogSettings(actor:string,input:unknown){
 const parsed=z.object({version:z.string().max(100),products:productsSchema}).safeParse(input);
 if(!parsed.success)throw Error('INVALID_CATALOG_SETTINGS');
 return transaction(async tx=>{
  await userLock(tx,'shop-catalog-settings');
  const before=await tx.shopCatalogSettings.findUnique({where:{id:'active'}});
  if((before?.version??'')!==parsed.data.version)throw Error('CATALOG_SETTINGS_CHANGED');
  const products=parsed.data.products.filter(row=>row.category||row.recommended),version=randomUUID();
  await tx.shopCatalogSettings.upsert({where:{id:'active'},create:{id:'active',products,version},update:{products,version}});
  await tx.auditLog.create({data:{actor,action:'SHOP_CATALOG_SETTINGS_UPDATED',entityId:'active',details:{productCount:products.length}}});
  return {version};
 });
}
export function bestSellerRanks(orders:{rawText:string|null}[]){
 const counts=new Map<string,{orders:number;quantity:number}>();
 for(const order of orders)for(const item of orderStockItems(order.rawText).items){const previous=counts.get(item.code)??{orders:0,quantity:0};counts.set(item.code,{orders:previous.orders+1,quantity:previous.quantity+item.quantityMilliG});}
 return new Map([...counts].sort((a,b)=>b[1].orders-a[1].orders||b[1].quantity-a[1].quantity||a[0].localeCompare(b[0])).slice(0,8).map(([code],index)=>[code,index+1]));
}
export async function loadBestSellerRanks(client:Prisma.TransactionClient=db,now=new Date()){
 const sales=await client.salesOrder.findMany({where:{recognizedAt:{gte:new Date(+now-30*86400000),lte:now},status:{in:['PENDING','PAID','WAITING_COST']},revenueSatang:{gt:0}}});
 if(!sales.length)return new Map<string,number>();
 const ids=sales.map(s=>s.orderId),tracking=sales.flatMap(s=>s.tracking?[s.tracking]:[]);
 const [orders,shipments,receipts]=await Promise.all([client.orderIntake.findMany({where:{id:{in:ids},withdrawnAt:null,status:{notIn:['CANCELLED','WITHDRAWN','RETURNED','EXPIRED']}}}),client.shipment.findMany({where:{orderId:{in:ids}}}),client.codReceipt.findMany({where:{tracking:{in:tracking}}})]);
 const orderById=new Map(orders.map(o=>[o.id,o])),shipmentByOrder=new Map(shipments.map(s=>[s.orderId,s])),receiptByTracking=new Map(receipts.map(r=>[r.tracking,r]));
 const recognized=new Set(sales.filter(s=>isRecognizedSale({...s,order:orderById.get(s.orderId)??null,shipment:shipmentByOrder.get(s.orderId)??null,receipt:receiptByTracking.get(s.tracking??'')??null,affiliate:null})).map(s=>s.orderId));
 return bestSellerRanks(orders.filter(order=>recognized.has(order.id)));
}
