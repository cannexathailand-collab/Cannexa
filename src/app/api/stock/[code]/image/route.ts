import {admin} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {db} from '@/lib/db';
import {stockCode} from '@/lib/stock-code';

export async function GET(request:Request,{params}:{params:Promise<{code:string}>}){
 try{await admin(approvers);}catch{return new Response('Forbidden',{status:403,headers:{'Cache-Control':'no-store'}});}
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
