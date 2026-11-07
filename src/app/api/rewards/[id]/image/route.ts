import {db} from '@/lib/db';

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const version=new URL(request.url).searchParams.get('v');
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(id)||!version||!/^[0-9a-f]{64}$/.test(version))return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 const reward=await db.crmReward.findUnique({where:{id},select:{imageData:true,imageMime:true,imageVersion:true}});
 if(!reward?.imageData||reward.imageVersion!==version||!['image/png','image/jpeg','image/webp'].includes(reward.imageMime??''))return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 const etag='"'+version+'"';
 const headers={
  'Content-Type':reward.imageMime!,
  'X-Content-Type-Options':'nosniff',
  'Cache-Control':'public, max-age=31536000, immutable',
  ETag:etag,
 };
 const matches=request.headers.get('if-none-match')?.split(',').some(value=>[etag,'W/'+etag,'*'].includes(value.trim()));
 if(matches)return new Response(null,{status:304,headers});
 return new Response(new Uint8Array(reward.imageData),{headers});
}
