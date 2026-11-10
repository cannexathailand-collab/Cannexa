import {customerCatalogAccess} from '@/lib/customer-catalog';
import {db} from '@/lib/db';

export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
 const access=await customerCatalogAccess();
 if(!access||access==='pending')return new Response('Forbidden',{status:403,headers});
 const version=new URL(request.url).searchParams.get('v');
 if(!version||!/^[a-f0-9]{64}$/.test(version))return new Response('Not found',{status:404,headers});
 const settings=await db.websitePaymentSettings.findUnique({where:{id:'active'},select:{qrImageData:true,qrImageMime:true,qrImageVersion:true}});
 if(!settings?.qrImageData||settings.qrImageVersion!==version||!['image/png','image/jpeg','image/webp'].includes(settings.qrImageMime??''))return new Response('Not found',{status:404,headers});
 return new Response(new Uint8Array(settings.qrImageData),{headers:{...headers,'Content-Type':settings.qrImageMime!}});
}
