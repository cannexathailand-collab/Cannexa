import {z} from 'zod';
import {db} from './db';
import {stockCode} from './stock-code';
import {loadCustomerCatalog} from './customer-catalog';
import {lineSettings} from './line-settings';

export const lineCardSelection=z.object({codes:z.array(stockCode).min(1).max(50)}).refine(value=>new Set(value.codes).size===value.codes.length,'Duplicate products');
export function cardSets<T>(items:T[]):T[][]{
 const sets:T[][]=[];for(let i=0;i<items.length;i+=5)sets.push(items.slice(i,i+5));return sets;
}
export function cardSetTitle(codes:string[],date=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'numeric'}).format(date);
 const title='New Arrivals '+parts+' | '+codes[0]+(codes.length>1?'–'+codes[codes.length-1]:'');
 return title.length<=100?title:'New Arrivals '+parts+' | '+codes.length+' products';
}
export async function prepareLineCardDraft(value:unknown){
 const input=lineCardSelection.parse(value);
 const [catalog,extras,connection,ai,descriptions]=await Promise.all([
  loadCustomerCatalog(db,{merchandising:false}),
  db.stockProductExtraImage.findMany({where:{code:{in:input.codes}},select:{code:true,slot:true,imageVersion:true}}),
  lineSettings(),
  db.openAiConnection.findUnique({where:{id:'active'},select:{id:true}}),
  db.stockProductDescription.findMany({where:{code:{in:input.codes}},select:{code:true,name:true,text:true,linkUrl:true}}),
 ]);
 const products=input.codes.map(code=>{
  const product=catalog.products.find(p=>p.code===code);
  if(!product)throw Error('PRODUCT_NOT_FOUND');
  const images=([1,2,3] as const).map(slot=>{
   const version=slot===1?product.imageVersion:extras.find(p=>p.code===code&&p.slot===slot)?.imageVersion;
   return {slot,url:version?'/api/stock/'+encodeURIComponent(code)+'/image?slot='+slot+'&v='+version:null};
  });
  const details=descriptions.find(item=>item.code===code&&item.name===(product.name??''));
  return {code,name:product.name,...(details?.text?{description:details.text}:{}),...(details?.linkUrl?{linkUrl:details.linkUrl}:{}),prices:product.prices,images,replyTitle:'ข้อมูล '+code,keyword:code,missingImageSlots:images.filter(i=>!i.url).map(i=>i.slot)};
 });
 return {version:1,createdAt:new Date().toISOString(),account:connection?.settings.basicId??null,aiConfigured:!!ai,status:'PREPARED' as const,
  sets:cardSets(products).map(items=>({title:cardSetTitle(items.map(p=>p.code)),products:items})),
  delivery:{savedToLineOA:false,sentToCustomers:false,requiresLocalRunner:true},
 };
}
