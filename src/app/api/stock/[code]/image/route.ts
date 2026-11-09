import {admin} from '@/lib/auth';
import {stockOperators} from '@/lib/accounts';
import {db} from '@/lib/db';
import {stockCode} from '@/lib/stock-code';
import {customerCatalogAccess} from '@/lib/customer-catalog';

export async function GET(request:Request,{params}:{params:Promise<{code:string}>}){
 try{await admin(stockOperators);}catch(error){
  if(!(error instanceof Error)||!['UNAUTHORIZED','FORBIDDEN'].includes(error.message))throw error;
  const access=await customerCatalogAccess();
  if(access!=='owner'&&access!=='customer')return new Response('Forbidden',{status:403,headers:{'Cache-Control':'no-store'}});
 }
 const parsed=stockCode.safeParse((await params).code);
 const version=new URL(request.url).searchParams.get('v');
 if(!parsed.success||!version||!/^[a-f0-9]{64}$/.test(version))return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 const product=await db.stockProductImage.findUnique({where:{code:parsed.data},select:{imageData:true,imageMime:true,imageVersion:true}});
 if(!product||product.imageVersion!==version||!['image/png','image/jpeg','image/webp'].includes(product.imageMime))return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 const etag='"'+version+'"';
 const headers={'Content-Type':product.imageMime,'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=0, must-revalidate',ETag:etag};
 const matches=request.headers.get('if-none-match')?.split(',').some(value=>[etag,'W/'+etag,'*'].includes(value.trim()));
 if(matches)return new Response(null,{status:304,headers});
 return new Response(new Uint8Array(product.imageData),{headers});
}
