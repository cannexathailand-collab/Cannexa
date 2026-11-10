import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Prisma} from '@prisma/client';
import {db,transaction,userLock,currentShopSlug} from './db';
import {parseRewardImage} from './crm-reward-image';

export const documentBrandingSchema=z.object({name:z.string(),color:z.string().regex(/^#[a-fA-F0-9]{6}$/),footer:z.string(),logoPath:z.string().nullable()});
export type DocumentBrandingSnapshot=z.infer<typeof documentBrandingSchema>;
export async function documentBrandingSnapshot(client:Prisma.TransactionClient=db):Promise<DocumentBrandingSnapshot>{
 const brand=await client.storeBranding.findUnique({where:{id:'active'}});
 const slug=currentShopSlug();
 return {name:brand?.name??'',color:brand?.color??'#087c59',footer:brand?.footer??'',logoPath:brand?.logoVersion?(slug?'/shops/'+encodeURIComponent(slug)+'/branding/logo/':'/api/branding/logo/')+brand.logoVersion:null};
}
const inputSchema=z.object({
 name:z.string().trim().max(150),color:z.string().regex(/^#[a-fA-F0-9]{6}$/),footer:z.string().trim().max(500),
 logo:z.string().max(2800000).nullable().optional(),expectedVersion:z.string().nullable(),
});
export async function saveDocumentBranding(actor:string,value:unknown){
 const {logo,expectedVersion,...fields}=inputSchema.parse(value);
 const image=typeof logo==='string'?parseRewardImage(logo):null;
 return transaction(async tx=>{
  await userLock(tx,'document-branding');
  const previous=await tx.storeBranding.findUnique({where:{id:'active'}});
  if((previous?.version??null)!==expectedVersion)throw Error('BRANDING_CONFLICT');
  if(image)await tx.storeBrandAsset.upsert({where:{id:image.imageVersion},create:{id:image.imageVersion,imageData:image.imageData,imageMime:image.imageMime},update:{}});
  const logoVersion=logo===undefined?previous?.logoVersion??null:image?.imageVersion??null;
  const data={...fields,logoVersion,version:randomUUID()};
  const saved=await tx.storeBranding.upsert({where:{id:'active'},create:{id:'active',...data},update:data});
  await tx.auditLog.create({data:{actor,action:'DOCUMENT_BRANDING_UPDATED',entityId:'active',details:{name:saved.name,hasLogo:!!logoVersion}}});
  return saved;
 });
}
export async function documentLogoResponse(version:string){
 if(!/^[a-f0-9]{64}$/.test(version))return new Response('Not found',{status:404});
 const asset=await db.storeBrandAsset.findUnique({where:{id:version}});
 if(!asset)return new Response('Not found',{status:404});
 return new Response(new Uint8Array(asset.imageData),{headers:{'Content-Type':asset.imageMime,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
}
