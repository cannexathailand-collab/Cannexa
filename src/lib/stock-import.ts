export type StockRow={code:string;name:string|null;costSatang:number|null;receivedQuantity:number|null;sourceRow:number};
export function stockRows(rows:unknown[][],{costColumnConfirmed=false}:{costColumnConfirmed?:boolean}={}):StockRow[]{
 const seen=new Set<string>();const products:StockRow[]=[];
 rows.forEach((row,index)=>{
  if(index<2)return;
  const raw=row[2];if(raw===null||raw===undefined||String(raw).trim()==='')return;
  const code=String(raw).trim().toUpperCase();if(!/^[A-Z]+\d+$/.test(code))throw new Error('INVALID_PRODUCT_CODE row '+(index+1));
  if(seen.has(code))throw new Error('DUPLICATE_PRODUCT_CODE '+code);seen.add(code);
  const name=typeof row[1]==='string'&&row[1].trim()?row[1].trim():null;
  const rawCost=row[3];let costSatang:number|null=null;
  if(costColumnConfirmed&&rawCost!==null&&rawCost!==undefined&&rawCost!==''){
   const n=typeof rawCost==='number'?rawCost:Number(String(rawCost).replace(/,/g,''));
   if(!Number.isFinite(n)||n<0||Math.abs(n*100-Math.round(n*100))>0.00001||!Number.isSafeInteger(Math.round(n*100)))throw new Error('INVALID_PRODUCT_COST '+code);
   costSatang=Math.round(n*100);
  }
  const rawQuantity=row[4];let receivedQuantity:number|null=null;
  if(rawQuantity!==null&&rawQuantity!==undefined&&rawQuantity!==''){
   const n=typeof rawQuantity==='number'?rawQuantity:Number(String(rawQuantity).replace(/,/g,''));
   if(!Number.isFinite(n)||Math.abs(n*1000-Math.round(n*1000))>0.0001||Math.abs(n)>=1e15)throw new Error('INVALID_PRODUCT_QUANTITY '+code);
   receivedQuantity=n;
  }
  products.push({code,name,costSatang,receivedQuantity,sourceRow:index+1});
 });return products;
}
