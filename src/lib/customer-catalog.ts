import {currentAccount} from './auth';
import {portalCustomer,hasPortalAccess} from './customer-portal';
import {db} from './db';
import {employeeStock} from './employee-stock';
import {stockCode} from './stock-code';
import {normalizeStockPackage} from './stock-product-input';
import {compareStockCodes} from './stock-sort';
import type {Prisma} from '@prisma/client';
import {loadShopCatalogSettings,loadBestSellerRanks} from './shop-catalog-settings';
import {loadStockSaleAvailability} from './stock-sale-availability';

export type CustomerCatalogPrice={pack:string;grams:number;priceSatang:number};
export type CustomerCatalogProduct={code:string;name:string|null;available:number|null;prices:CustomerCatalogPrice[];imageVersion:string|null;saleEnabled?:boolean;description?:string;category?:string;recommended?:boolean;bestSellerRank?:number};
export type CatalogProduct=CustomerCatalogProduct;
export type CustomerCatalog={products:CustomerCatalogProduct[];readAt:string|null};

export async function customerCatalogAccess():Promise<'owner'|'customer'|'pending'|null>{
 try{if((await currentAccount()).role==='owner')return 'owner';}
 catch(error){if(!(error instanceof Error)||error.message!=='UNAUTHORIZED')throw error;}
 const {key,customer}=await portalCustomer();
 if(customer?.portalRegistrationPending||customer?.portalProfileIncomplete)return 'pending';
 return customer&&await hasPortalAccess(key,customer.code)?'customer':null;
}

export function customerCatalogPrices(value:unknown):CustomerCatalogPrice[]{
 const prices=new Map<string,CustomerCatalogPrice|null>();
 for(const raw of Array.isArray(value)?value:[]){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
  let pack:string;
  try{pack=normalizeStockPackage(raw.pack);}catch{continue;}
  if(prices.has(pack)){prices.set(pack,null);continue;}
  const price=raw.priceSatang;
  prices.set(pack,typeof price==='number'&&Number.isSafeInteger(price)&&price>=0?{pack,grams:Number(pack.slice(0,-1)),priceSatang:price}:null);
 }
 return [...prices.values()].filter((price):price is CustomerCatalogPrice=>price!==null).sort((a,b)=>a.grams-b.grams);
}

export async function loadCustomerCatalog(client:Prisma.TransactionClient=db,options:{merchandising?:boolean}={}):Promise<CustomerCatalog>{
 const snapshot=await employeeStock(client);
 const products=new Map<string,Omit<CustomerCatalogProduct,'imageVersion'>|null>();
 for(const raw of Array.isArray(snapshot.rows)?snapshot.rows:[]){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
  const parsed=stockCode.safeParse(raw.code);
  if(!parsed.success)continue;
  const code=parsed.data;
  if(products.has(code)){products.set(code,null);continue;}
  products.set(code,{code,name:typeof raw.name==='string'&&raw.name.trim()?raw.name.trim():null,available:typeof raw.available==='number'&&Number.isFinite(raw.available)?Math.max(0,raw.available):null,prices:customerCatalogPrices(raw.prices)});
 }
 const visible=[...products.values()].filter((product):product is Omit<CustomerCatalogProduct,'imageVersion'>=>product!==null).sort((a,b)=>compareStockCodes(a.code,b.code));
 const images=visible.length?await client.stockProductImage.findMany({where:{code:{in:visible.map(product=>product.code)}},select:{code:true,imageVersion:true}}):[];
 const versions=new Map(images.map(image=>[image.code,/^[a-f0-9]{64}$/.test(image.imageVersion)?image.imageVersion:null]));
 const paused=new Set((await loadStockSaleAvailability(client)).filter(entry=>!entry.enabled).map(entry=>entry.code));
 const enrich=options.merchandising!==false&&visible.length>0;
 const [settings,ranks,descriptions]=await Promise.all([enrich?loadShopCatalogSettings(client):Promise.resolve({products:[],version:''}),enrich?loadBestSellerRanks(client):Promise.resolve(new Map<string,number>()),enrich?client.customerProductDescription.findMany({where:{code:{in:visible.map(product=>product.code)}},select:{code:true,name:true,description:true}}):Promise.resolve([])]);
 const presentation=new Map(settings.products.map(row=>[row.code,row]));
 const descriptionByCode=new Map(descriptions.map(row=>[row.code,row]));
 return {products:visible.map(product=>{const detail=presentation.get(product.code),text=descriptionByCode.get(product.code);return {...product,...(paused.has(product.code)?{saleEnabled:false}:{}),imageVersion:versions.get(product.code)??null,...(text?.name===(product.name??'')&&text.description?{description:text.description}:{}),...(detail?.category?{category:detail.category}:{}),...(detail?.recommended?{recommended:true}:{}),...(ranks.has(product.code)?{bestSellerRank:ranks.get(product.code)}:{})};}),readAt:snapshot.readAt?.toISOString()??null};
}
