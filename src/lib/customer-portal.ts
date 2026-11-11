import {customerUsername} from './customer-username';
import {customerDiscoverySource} from './customer-discovery-source';
import {saveCustomerDeliveryAddresses} from './customer-delivery-addresses';
import type {Prisma} from '@prisma/client';
import {canonicalCustomerCode} from './customer-code';
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
 return session.key===key&&session.customer?.code===code&&!session.customer.portalRegistrationPending&&!session.customer.portalProfileIncomplete&&(session.marketingEntry||!!validContactPhones(session.customer.phone??''));
}
export const portalDuration=86400;
export function portalToken(key:string,entry:'standard'|'marketing'='standard'){return signToken({purpose:'CUSTOMER_PORTAL',key,...(entry==='marketing'?{marketingEntry:true}:{}),exp:Date.now()+portalDuration*1000});}
export function readPortalToken(value:string){
 const token=readToken<{purpose?:string;key?:string;exp?:number}>(value);
 return token?.purpose==='CUSTOMER_PORTAL'&&typeof token.key==='string'&&/^[a-f0-9]{64}$/.test(token.key)&&typeof token.exp==='number'&&token.exp>Date.now()?token.key:null;
}
export function readPortalMarketingEntry(value:string){
 return !!readPortalToken(value)&&readToken<{marketingEntry?:unknown}>(value)?.marketingEntry===true;
}
export async function portalKey(){return readPortalToken((await cookies()).get(portalCookie)?.value??'');}
export function portalPasswordVersion(customer:{portalPasswordSalt:string|null;portalPasswordHash:string|null}){
 return sha(JSON.stringify([customer.portalPasswordSalt,customer.portalPasswordHash]));
}
export function portalPasswordToken(customer:{code:string;portalPasswordSalt:string|null;portalPasswordHash:string|null}){
 return signToken({purpose:'CUSTOMER_PASSWORD_SESSION',code:customer.code,version:portalPasswordVersion(customer),exp:Date.now()+portalDuration*1000});
}
export async function portalCustomer(){
 const value=(await cookies()).get(portalCookie)?.value??'';
 const key=readPortalToken(value);
 if(key){
  const customer=await db.customer.findUnique({where:{lineUserKey:key}});
  return {key,customer:customer??await linkPortalCustomer(key),method:'line' as const,marketingEntry:readPortalMarketingEntry(value)};
 }
 const token=readToken<{purpose?:string;code?:string;version?:string;exp?:number}>((await cookies()).get(portalPasswordCookie)?.value??'');
 if(token?.purpose==='CUSTOMER_PASSWORD_SESSION'&&typeof token.code==='string'&&token.code.length<=30&&typeof token.version==='string'&&/^[a-f0-9]{64}$/.test(token.version)&&typeof token.exp==='number'&&token.exp>Date.now()){
  const customer=await db.customer.findUnique({where:{code:token.code}});
  if(customer&&!customer.portalRegistrationPending&&!customer.portalProfileIncomplete&&customer.portalPasswordSalt&&customer.portalPasswordHash&&equal(token.version,portalPasswordVersion(customer)))return {key:null,customer,method:'password' as const,marketingEntry:false};
 }
 return {key:null,customer:null,method:null,marketingEntry:false};
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
 if(!phones)throw Error('กรุณากรอกเบอร์โทรแต่ละเบอร์ให้ครบ 10 หลัก');
 if(!address||address.length>2000||!/(?<!\d)\d{5}(?!\d)/.test(address))throw Error('กรุณากรอกที่อยู่พร้อมรหัสไปรษณีย์ 5 หลัก');
 const title=typeof input.title==='string'?input.title.trim():'';
 if(input.title!==undefined&&(!title||title.length>40))throw Error('กรุณากรอกคำนำหน้าไม่เกิน 40 ตัวอักษร');
 return {name,phone:phones.join(' / '),address,...(input.title!==undefined?{title}:{})};
}
export async function linkPortalCustomer(key:string,linkHash?:string|null){
 return transaction(async tx=>{
  await userLock(tx,key);
  const existing=await tx.customer.findUnique({where:{lineUserKey:key}});
  if(!linkHash){
   if(existing)return existing;
   const conversion=await tx.conversion.findUnique({where:{userKey:key}});
   const assigned=conversion?await tx.customer.findUnique({where:{code:conversion.customerCode}}):null;
   if(assigned){
    if(assigned.lineUserKey&&assigned.lineUserKey!==key)throw Error('LINK_CONFLICT');
    const saved=await tx.customer.update({where:{code:assigned.code},data:{lineUserKey:key}});
    await tx.auditLog.create({data:{actor:'customer',action:'CUSTOMER_LINE_LINKED',entityId:saved.code,details:{}}});
    return saved;
   }
   const created=await tx.customer.create({data:{
    ...(conversion?{code:conversion.customerCode,conversionId:conversion.id}:{}),
    lineUserKey:key,portalRegistrationPending:true,portalProfileIncomplete:true,
   }});
   await tx.auditLog.create({data:{actor:'customer',action:'CUSTOMER_LINE_REGISTERED',entityId:created.code,details:{source:'line-login'}}});
   return created;
  }
  const link=await tx.customerAccessLink.findUnique({where:{tokenHash:linkHash}});
  if(!link||link.usedAt||link.expiresAt&&link.expiresAt<=new Date())throw Error('LINK_EXPIRED');
  const customer=await tx.customer.findUniqueOrThrow({where:{code:link.customerCode}});
  const conversion=await tx.conversion.findUnique({where:{userKey:key}});
  if(existing&&existing.code!==customer.code||customer.lineUserKey&&customer.lineUserKey!==key||conversion&&conversion.customerCode!==customer.code)throw Error('LINK_CONFLICT');
  const claimed=await tx.customerAccessLink.updateMany({where:{tokenHash:linkHash,usedAt:null,OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]},data:{usedAt:new Date()}});
  if(claimed.count!==1)throw Error('LINK_EXPIRED');
  const complete=!!validContactPhones(customer.phone??'');
  const saved=await tx.customer.update({where:{code:customer.code},data:{lineUserKey:key,...(complete?{portalRegistrationPending:false,portalProfileIncomplete:false,registeredAt:customer.registeredAt??new Date()}: {})}});
  await tx.auditLog.create({data:{actor:'customer',action:'CUSTOMER_LINE_LINKED',entityId:saved.code,details:{}}});
  return saved;
 });
}
async function findCustomerReferrer(tx:Prisma.TransactionClient,value:unknown){
 if(!value)return null;
 if(typeof value!=='string'||value.length>100)throw Error('กรุณาตรวจสอบรหัสผู้แนะนำ');
 const code=value.trim();
 if(!code)return null;
 const matches=await tx.affiliate.findMany({where:{code:{equals:code,mode:'insensitive'},active:true,archivedAt:null},select:{id:true},take:2});
 if(matches.length!==1)throw Error('กรุณาตรวจสอบรหัสผู้แนะนำ ไม่พบรหัสที่ใช้งานได้');
 return matches[0].id;
}

export async function savePortalProfile(key:string|null,input:Parameters<typeof portalProfile>[0]&{referrerCode?:unknown;username?:unknown;discoverySource?:unknown},customerCode?:string){
 const data=portalProfile(input);
 const discoverySource=customerDiscoverySource(input.discoverySource);
 const sourceData=discoverySource===undefined?{}:{discoverySource};
 return transaction(async tx=>{
  if(!key&&!customerCode)throw Error('UNAUTHORIZED');
  await userLock(tx,key??'customer-profile:'+customerCode);
  const existing=key?await tx.customer.findUnique({where:{lineUserKey:key}}):await tx.customer.findUnique({where:{code:customerCode}});
  if(!key&&(!existing||existing.portalRegistrationPending))throw Error('UNAUTHORIZED');
  if(existing)await userLock(tx,'customer-profile:'+existing.code);
  const profileData=existing?{...data,phone:[...new Set([...(validContactPhones(existing.phone??'')??[]),...validContactPhones(data.phone)!])].join(' / ')}:data;
  const username=input.username===undefined?existing?.portalUsername??null:customerUsername(input.username);
  if(username){
   await userLock(tx,'customer-username:'+username);
   const owner=await tx.customer.findUnique({where:{portalUsername:username},select:{code:true}});
   const reserved=await tx.customer.findUnique({where:{code:canonicalCustomerCode(username)},select:{code:true}});
   if(owner&&owner.code!==existing?.code||reserved&&reserved.code!==existing?.code)throw Error('กรุณาเลือกชื่อผู้ใช้อื่น ชื่อนี้ถูกใช้แล้ว');
  }
  for(const phone of validContactPhones(profileData.phone)!.sort())await userLock(tx,'draft-customer-phone:'+phone);
  let referrerId:string|null=null;
  if((!existing||existing.portalProfileIncomplete&&!existing.referrerId)&&input.referrerCode){
   referrerId=await findCustomerReferrer(tx,input.referrerCode);
  }
  const matches=await matchingCustomerPhones(tx,profileData.phone);
  if(matches.some(row=>row.code!==existing?.code))throw Error('EXISTING_CUSTOMER');
  const identityKey=customerIdentity(profileData.name,profileData.phone);
  const saved=existing?await tx.customer.update({where:{code:existing.code},data:{...profileData,...sourceData,identityKey,portalUsername:username,...(existing.portalProfileIncomplete?{registeredAt:new Date(),portalProfileIncomplete:false,portalRegistrationPending:true,...(referrerId?{referrerId}:{})}:{})}}):await tx.customer.create({data:{...profileData,...sourceData,identityKey,portalUsername:username,lineUserKey:key,registeredAt:new Date(),portalRegistrationPending:true,referrerId}});
  await saveCustomerDeliveryAddresses(tx,saved.code,existing?[{...existing,preserve:true},data]:[data]);
  await tx.auditLog.create({data:{actor:'customer',action:existing?'CUSTOMER_PROFILE_UPDATED':'CUSTOMER_REGISTERED',entityId:saved.code,details:{source:'customer-portal'}}});
  return saved;
 });
}

export async function savePortalPhone(key:string|null,phoneInput:unknown,customerCode?:string,sourceInput?:unknown,referrerInput?:unknown){
 const discoverySource=customerDiscoverySource(sourceInput);
 const phones=typeof phoneInput==='string'?validContactPhones(phoneInput):null;
 if(!phones||phones.length!==1)throw Error('กรุณากรอกเบอร์โทรให้ครบ 10 หลัก');
 const phone=phones[0];
 return transaction(async tx=>{
  if(!key&&!customerCode)throw Error('UNAUTHORIZED');
  await userLock(tx,key??'customer-profile:'+customerCode);
  const customer=key?await tx.customer.findUnique({where:{lineUserKey:key}}):await tx.customer.findUnique({where:{code:customerCode}});
  if(!customer)throw Error('UNAUTHORIZED');
  if(!customer.portalProfileIncomplete&&validContactPhones(customer.phone??'')){
   if(!customer.portalRegistrationPending&&customer.phone===phone)return customer;
   throw Error('กรุณาแก้ไขเบอร์โทรในหน้าข้อมูลส่วนตัว');
  }
  await userLock(tx,'customer-profile:'+customer.code);
  await userLock(tx,'draft-customer-phone:'+phone);
  const matches=await matchingCustomerPhones(tx,phone);
  if(matches.some(row=>row.code!==customer.code))throw Error('EXISTING_CUSTOMER');
  const referrerId=customer.referrerId??await findCustomerReferrer(tx,referrerInput);
  const saved=await tx.customer.update({where:{code:customer.code},data:{phone,registeredAt:customer.registeredAt??new Date(),registrationPhone:customer.registrationPhone??phone,referrerId,...(discoverySource===undefined?{}:{discoverySource}),portalProfileIncomplete:false,portalRegistrationPending:false}});
  await tx.auditLog.create({data:{actor:'customer',action:'CUSTOMER_PHONE_REGISTERED',entityId:saved.code,details:{source:key?'line-login':'password-login'}}});
  return saved;
 });
}
