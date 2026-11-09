import {Prisma} from '@prisma/client';
import {db} from './db';
import {applyWorkbookRequests,readWorkbook,type StockWorkbookState} from './stock-workbook-state';

export async function stockWorkbookClient(){
 if(!await db.stockWorkbook.findUnique({where:{id:'active'},select:{id:true}}))return null;
 return async(path:string,init:RequestInit={})=>{
  for(let attempt=0;attempt<10;attempt++){
   const saved=await db.stockWorkbook.findUniqueOrThrow({where:{id:'active'}});
   const state=saved.state as unknown as StockWorkbookState;
   const body=init.body?JSON.parse(String(init.body)):undefined;
   if(path!==':batchUpdate')return readWorkbook(state,path,body);
   if(!Array.isArray(body?.requests))throw Error('STOCK_SYSTEM_BATCH_INVALID');
   const next=applyWorkbookRequests(state,body.requests);
   const written=await db.stockWorkbook.updateMany({where:{id:'active',version:saved.version},data:{state:next as unknown as Prisma.InputJsonValue,version:{increment:1},dirty:true}});
   if(written.count)return {replies:body.requests.map(()=>({}))};
  }
  throw Error('STOCK_SYSTEM_BUSY');
 };
}
