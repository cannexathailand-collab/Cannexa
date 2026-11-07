import {cookies} from 'next/headers';
import {db,transaction,userLock} from './db';
import {readToken,signToken} from './crypto';
import {validContactPhones} from './contact-phones';
import {matchingCustomerPhones} from './draft-customer-identity';
import {customerIdentity} from './order-customer';

export const portalCookie='customer_portal';
export const portalAccessCookie='customer_access';
export function portalAccessToken(key:string,code:string){return signToken({purpose:'CUSTOMER_ACCESS',key,code,exp:Date.now()+portalDuration*1000});}
export async function hasPortalAccess(key:string,code:string){
 const token=readToken<{purpose:string;key:string;code:string;exp:number}>((await cookies()).get(portalAccessCookie)?.value??'');
 return !!token&&token.purpose==='CUSTOMER_ACCESS'&&token.key===key&&token.code===code&&token.exp>Date.now();
}
export const portalDuration=86400;
export function portalToken(key:string){return signToken({purpose:'CUSTOMER_PORTAL',key,exp:Date.now()+portalDuration*1000});}
export function readPortalToken(value:string){
 const token=readToken<{purpose?:string;key?:string;exp?:number}>(value);
 return token?.purpose==='CUSTOMER_PORTAL'&&typeof token.key==='string'&&/^[a-f0-9]{64}$/.test(token.key)&&typeof token.exp==='number'&&token.exp>Date.now()?token.key:null;
}
export async function portalKey(){return readPortalToken((await cookies()).get(portalCookie)?.value??'');}
export async function portalCustomer(){const key=await portalKey();return {key,customer:key?await db.customer.findUnique({where:{lineUserKey:key}}):null};}
export function portalProfile(input:{name?:unknown;phone?:unknown;address?:unknown;houseNumber?:unknown;road?:unknown;subdistrict?:unknown;district?:unknown;province?:unknown;postalCode?:unknown}){
 const name=typeof input.name==='string'?input.name.trim():'';
 let address=typeof input.address==='string'?input.address.trim():'';
 if(input.houseNumber!==undefined){
  const fields=['houseNumber','road','subdistrict','district','province','postalCode'] as const;
  const parts=Object.fromEntries(fields.map(field=>[field,typeof input[field]==='string'?input[field].trim():'']));
  if(!parts.houseNumber||!parts.subdistrict||!parts.district||!parts.province)throw Error('กรุณากรอกบ้านเลขที่ ตำบล อำเภอ และจังหวัดให้ครบ');
  if(!/^\d{5}$/.test(parts.postalCode))throw Error('กรุณากรอกรหัสไปรษณีย์ให้ครบ 5 หลัก');
  address=[parts.houseNumber,parts.road&&'ถนน '+parts.road,'ตำบล/แขวง '+parts.subdistrict,'อำเภอ/เขต '+parts.district,'จังหวัด '+parts.province,parts.postalCode].filter(Boolean).join(' ');
 }
 const phones=typeof input.phone==='string'?validContactPhones(input.phone):null;
 if(!name||name.length>200)throw Error('กรุณากรอกชื่อผู้รับไม่เกิน 200 ตัวอักษร');
 if(!phones||phones.length>2)throw Error('กรุณากรอกเบอร์โทรให้ครบ 10 หลัก รองรับสูงสุด 2 เบอร์');
 if(!address||address.length>2000||!/(?<!\d)\d{5}(?!\d)/.test(address))throw Error('กรุณากรอกที่อยู่พร้อมรหัสไปรษณีย์ 5 หลัก');
 return {name,phone:phones.join(' / '),address};
}
export async function linkPortalCustomer(key:string,linkHash?:string|null){
 return transaction(async tx=>{
  await userLock(tx,key);
  const existing=await tx.customer.findUnique({where:{lineUserKey:key}});
  if(!linkHash)return existing;
  const link=await tx.customerAccessLink.findUnique({where:{tokenHash:linkHash}});
  if(!link||link.usedAt||link.expiresAt<=new Date())throw Error('LINK_EXPIRED');
  const customer=await tx.customer.findUniqueOrThrow({where:{code:link.customerCode}});
  const conversion=await tx.conversion.findUnique({where:{userKey:key}});
  if(existing&&existing.code!==customer.code||customer.lineUserKey&&customer.lineUserKey!==key||conversion&&conversion.customerCode!==customer.code)throw Error('LINK_CONFLICT');
  const claimed=await tx.customerAccessLink.updateMany({where:{tokenHash:linkHash,usedAt:null,expiresAt:{gt:new Date()}},data:{usedAt:new Date()}});
  if(claimed.count!==1)throw Error('LINK_EXPIRED');
  const saved=await tx.customer.update({where:{code:customer.code},data:{lineUserKey:key}});
  await tx.auditLog.create({data:{actor:'customer',action:'CUSTOMER_LINE_LINKED',entityId:saved.code,details:{}}});
  return saved;
 });
}
export async function savePortalProfile(key:string,input:Parameters<typeof portalProfile>[0]&{referrerCode?:unknown}){
 const data=portalProfile(input);
 return transaction(async tx=>{
  await userLock(tx,key);
  for(const phone of validContactPhones(data.phone)!.sort())await userLock(tx,'draft-customer-phone:'+phone);
  const existing=await tx.customer.findUnique({where:{lineUserKey:key}});
  let referrerId:string|null=null;
  if(!existing&&input.referrerCode){
   if(typeof input.referrerCode!=='string'||input.referrerCode.length>100)throw Error('กรุณาตรวจสอบรหัสผู้แนะนำ');
   const code=input.referrerCode.trim();
   if(code){
    const matches=await tx.affiliate.findMany({where:{code:{equals:code,mode:'insensitive'},active:true,archivedAt:null},select:{id:true},take:2});
    if(matches.length!==1)throw Error('กรุณาตรวจสอบรหัสผู้แนะนำ ไม่พบรหัสที่ใช้งานได้');
    referrerId=matches[0].id;
   }
  }
  const matches=await matchingCustomerPhones(tx,data.phone);
  if(matches.some(row=>row.code!==existing?.code))throw Error('EXISTING_CUSTOMER');
  const identityKey=customerIdentity(data.name,data.phone);
  const saved=existing?await tx.customer.update({where:{code:existing.code},data:{...data,identityKey}}):await tx.customer.create({data:{...data,identityKey,lineUserKey:key,portalRegistrationPending:true,referrerId}});
  await tx.auditLog.create({data:{actor:'customer',action:existing?'CUSTOMER_PROFILE_UPDATED':'CUSTOMER_REGISTERED',entityId:saved.code,details:{source:'customer-portal'}}});
  return saved;
 });
}
