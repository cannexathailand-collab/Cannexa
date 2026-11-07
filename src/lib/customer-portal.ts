import {cookies} from 'next/headers';
import {db,transaction,userLock} from './db';
import {equal,readToken,sha,signToken} from './crypto';
import {validContactPhones} from './contact-phones';
import {matchingCustomerPhones} from './draft-customer-identity';
import {customerIdentity} from './order-customer';

export const portalCookie='customer_portal';
export const portalAccessCookie='customer_access';
export const portalPasswordCookie='customer_password_session';
export function portalAccessToken(key:string,code:string){return signToken({purpose:'CUSTOMER_ACCESS',key,code,exp:Date.now()+portalDuration*1000});}
export async function hasPortalAccess(key:string|null,code:string){
 const session=await portalCustomer();
 return session.key===key&&session.customer?.code===code&&!session.customer.portalRegistrationPending;
}
export const portalDuration=86400;
export function portalToken(key:string){return signToken({purpose:'CUSTOMER_PORTAL',key,exp:Date.now()+portalDuration*1000});}
export function readPortalToken(value:string){
 const token=readToken<{purpose?:string;key?:string;exp?:number}>(value);
 return token?.purpose==='CUSTOMER_PORTAL'&&typeof token.key==='string'&&/^[a-f0-9]{64}$/.test(token.key)&&typeof token.exp==='number'&&token.exp>Date.now()?token.key:null;
}
export async function portalKey(){return readPortalToken((await cookies()).get(portalCookie)?.value??'');}
export function portalPasswordVersion(customer:{portalPasswordSalt:string|null;portalPasswordHash:string|null}){
 return sha(JSON.stringify([customer.portalPasswordSalt,customer.portalPasswordHash]));
}
export function portalPasswordToken(customer:{code:string;portalPasswordSalt:string|null;portalPasswordHash:string|null}){
 return signToken({purpose:'CUSTOMER_PASSWORD_SESSION',code:customer.code,version:portalPasswordVersion(customer),exp:Date.now()+portalDuration*1000});
}
export async function portalCustomer(){
 const key=await portalKey();
 if(key)return {key,customer:await db.customer.findUnique({where:{lineUserKey:key}}),method:'line' as const};
 const token=readToken<{purpose?:string;code?:string;version?:string;exp?:number}>((await cookies()).get(portalPasswordCookie)?.value??'');
 if(token?.purpose==='CUSTOMER_PASSWORD_SESSION'&&typeof token.code==='string'&&token.code.length<=30&&typeof token.version==='string'&&/^[a-f0-9]{64}$/.test(token.version)&&typeof token.exp==='number'&&token.exp>Date.now()){
  const customer=await db.customer.findUnique({where:{code:token.code}});
  if(customer&&!customer.portalRegistrationPending&&customer.portalPasswordSalt&&customer.portalPasswordHash&&equal(token.version,portalPasswordVersion(customer)))return {key:null,customer,method:'password' as const};
 }
 return {key:null,customer:null,method:null};
}
export function portalProfile(input:{title?:unknown;name?:unknown;phone?:unknown;address?:unknown;houseNumber?:unknown;road?:unknown;subdistrict?:unknown;district?:unknown;province?:unknown;postalCode?:unknown}){
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
 const title=typeof input.title==='string'?input.title.trim():'';
 if(input.title!==undefined&&(!title||title.length>40))throw Error('กรุณากรอกคำนำหน้าไม่เกิน 40 ตัวอักษร');
 return {name,phone:phones.join(' / '),address,...(input.title!==undefined?{title}:{})};
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
export async function savePortalProfile(key:string|null,input:Parameters<typeof portalProfile>[0]&{referrerCode?:unknown},customerCode?:string){
 const data=portalProfile(input);
 return transaction(async tx=>{
  if(!key&&!customerCode)throw Error('UNAUTHORIZED');
  await userLock(tx,key??'customer-profile:'+customerCode);
  const existing=key?await tx.customer.findUnique({where:{lineUserKey:key}}):await tx.customer.findUnique({where:{code:customerCode}});
  if(!key&&(!existing||existing.portalRegistrationPending))throw Error('UNAUTHORIZED');
  if(existing)await userLock(tx,'customer-profile:'+existing.code);
  for(const phone of validContactPhones(data.phone)!.sort())await userLock(tx,'draft-customer-phone:'+phone);
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
