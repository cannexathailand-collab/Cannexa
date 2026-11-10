import {z} from 'zod';
import {transaction,userLock} from './db';
import {portalProfile} from './customer-portal';
import {contactPhones} from './contact-phones';
import {matchingCustomerPhones} from './draft-customer-identity';
import {customerIdentity} from './order-customer';
import {canonicalCustomerCode,displayCustomerCode} from './customer-code';
import {passwordHash,random} from './crypto';
import {bangkokDay,shiftMonth} from './sales-dates';

export const registrationLevels=['ลูกค้าใหม่','Bronze','Silver','Gold','VIP Platinum'] as const;
const registrationSchema=z.object({
 name:z.string(),phone:z.string(),address:z.string(),
 level:z.enum(registrationLevels),
 keepLevel:z.boolean().default(false),
 password:z.string().min(8,'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').max(256,'รหัสผ่านยาวเกินไป'),
 confirmation:z.string(),
}).refine(input=>input.password===input.confirmation,{message:'รหัสผ่านและช่องยืนยันไม่ตรงกัน'});

export class CustomerRegistrationInputError extends Error {}

export function parseCustomerRegistration(input:unknown){
 const parsed=registrationSchema.safeParse(input);
 if(!parsed.success)throw new CustomerRegistrationInputError(parsed.error.issues[0]?.message??'กรุณาตรวจสอบข้อมูลลูกค้า');
 try{
  return {...portalProfile(parsed.data),level:parsed.data.level,keepLevel:parsed.data.keepLevel,password:parsed.data.password};
 }catch(error){
  throw new CustomerRegistrationInputError(error instanceof Error?error.message:'กรุณาตรวจสอบข้อมูลลูกค้า');
 }
}

export async function registerCustomerByAdmin(input:unknown,actor:string,at=new Date()){
 const {level,password,keepLevel,...profile}=parseCustomerRegistration(input);
 const salt=random(),hash=passwordHash(password,salt);
 return transaction(async tx=>{
  // Use the same locks as order entry and customer self-registration.
  for(const phone of contactPhones(profile.phone).sort())await userLock(tx,'draft-customer-phone:'+phone);
  const existing=await matchingCustomerPhones(tx,profile.phone);
  if(existing.length)return {created:false as const,customers:existing.map(customer=>({code:displayCustomerCode(customer.code),name:customer.name??''}))};
  await userLock(tx,'crm-monthly-membership');
  const customer=await tx.customer.create({data:{
   ...profile,identityKey:customerIdentity(profile.name,profile.phone),
   portalRegistrationPending:false,portalProfileIncomplete:false,
   portalPasswordSalt:salt,portalPasswordHash:hash,
  }});
  const month=bangkokDay(at).slice(0,7);
  await tx.crmMembershipReview.create({data:{
   customerCode:customer.code,month,assessedMonth:shiftMonth(month+'-01',-1).slice(0,7),
   level,failedMonths:0,decision:keepLevel?'MANUAL_LOCKED':'MANUAL_INITIAL',metrics:{source:'admin-registration'},
  }});
  await tx.auditLog.create({data:{actor,action:'CUSTOMER_REGISTERED_BY_ADMIN',entityId:customer.code,details:{level,keepLevel,source:'back-office'}}});
  return {created:true as const,customer:{code:displayCustomerCode(customer.code),name:customer.name??'',level,locked:keepLevel}};
 });
}

const membershipChangeSchema=z.object({code:z.string().min(1).max(30),level:z.enum(['ยังไม่เข้าเกณฑ์',...registrationLevels]),keepLevel:z.boolean()});
export async function setCustomerMembership(input:unknown,actor:string,at=new Date()){
 const parsed=membershipChangeSchema.safeParse(input);
 if(!parsed.success)throw new CustomerRegistrationInputError('กรุณาเลือกรหัสลูกค้าและระดับสมาชิกให้ถูกต้อง');
 const {level,keepLevel}=parsed.data,code=canonicalCustomerCode(parsed.data.code);
 return transaction(async tx=>{
  await userLock(tx,'crm-monthly-membership');
  const customer=await tx.customer.findUnique({where:{code},select:{code:true}});
  if(!customer)return null;
  const month=bangkokDay(at).slice(0,7);
  const previous=await tx.crmMembershipReview.findFirst({where:{customerCode:code,month:{lte:month}},orderBy:{month:'desc'}});
  const decision=keepLevel?'MANUAL_LOCKED':'MANUAL_SET';
  await tx.crmMembershipReview.upsert({
   where:{customerCode_month:{customerCode:code,month}},
   create:{customerCode:code,month,assessedMonth:shiftMonth(month+'-01',-1).slice(0,7),level,failedMonths:0,decision,metrics:{source:'admin-membership'}},
   update:{level,failedMonths:0,decision},
  });
  await tx.auditLog.create({data:{actor,action:'CUSTOMER_MEMBERSHIP_CHANGED',entityId:code,details:{previousLevel:previous?.level??null,previousLocked:previous?.decision==='MANUAL_LOCKED',level,keepLevel}}});
  return {code:displayCustomerCode(code),level,locked:keepLevel};
 });
}
