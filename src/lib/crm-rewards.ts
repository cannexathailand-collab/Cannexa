import {z} from 'zod';
import {transaction,userLock} from './db';
import {canonicalCustomerCode} from './customer-code';
import {loadCustomerCrm} from './customer-crm';
import {portalProfile} from './customer-portal';
import {sha} from './crypto';
import {parseRewardImage} from './crm-reward-image';
import {dayStart,shiftDay} from './sales-dates';

const rewardMetadata={id:true,requestKey:true,requestFingerprint:true,name:true,description:true,points:true,availableUnits:true,enabled:true,createdAt:true,updatedAt:true,imageMime:true,imageVersion:true,expiresAt:true} as const;

const rewardInput=z.object({
 id:z.string().min(1).max(100).optional(),
 requestKey:z.string().min(16).max(100),
 name:z.string().trim().min(1).max(120),
 description:z.string().trim().max(1000).default(''),
 points:z.number().int().positive().max(1000000000),
 availableUnits:z.number().int().min(0).max(1000000),
 enabled:z.boolean(),
 expectedUpdatedAt:z.string().optional(),
 image:z.string().optional(),
 endsOn:z.string().trim().max(10).optional(),
});
const redemptionInput=z.object({
 rewardId:z.string().min(1).max(100),requestKey:z.string().min(16).max(100),
 expectedPoints:z.number().int().positive().max(1000000000),expectedRewardName:z.string().min(1).max(120),
});
const resolutionInput=z.object({id:z.string().min(1).max(100),status:z.enum(['FULFILLED','REJECTED'])});

export async function saveReward(actor:string,value:unknown){
 const result=rewardInput.safeParse(value);
 if(!result.success)throw Error('INVALID_REWARD');
 const input=result.data;
 if(input.id&&!input.expectedUpdatedAt)throw Error('REWARD_VERSION_REQUIRED');
 const expected=input.expectedUpdatedAt?new Date(input.expectedUpdatedAt):null;
 if(expected&&!Number.isFinite(+expected))throw Error('INVALID_REWARD');
 const image=input.image===undefined?undefined:parseRewardImage(input.image);
 let expiresAt:Date|null|undefined;
 if(input.endsOn!==undefined){
  try{expiresAt=input.endsOn?dayStart(shiftDay(input.endsOn,1)):null;}
  catch{throw Error('INVALID_REWARD_EXPIRY');}
 }
 const metadata={name:input.name,description:input.description,points:input.points,availableUnits:input.availableUnits,enabled:input.enabled};
 const data={...metadata,...image,...(expiresAt!==undefined?{expiresAt}:{})};
 const requestFingerprint=sha(JSON.stringify({...metadata,...(image?{imageVersion:image.imageVersion}:{}),...(expiresAt?{expiresAt:expiresAt.toISOString()}:{})}));
 return transaction(async tx=>{
  await userLock(tx,input.id?'crm-reward:'+input.id:'crm-reward-create:'+input.requestKey);
  if(input.id){
   const previous=await tx.crmReward.findUnique({where:{id:input.id},select:rewardMetadata});
   if(!previous)throw Error('REWARD_NOT_FOUND');
   if(+previous.updatedAt!==+expected!)throw Error('REWARD_VERSION_CONFLICT');
   const updated=await tx.crmReward.updateMany({where:{id:input.id,updatedAt:expected!},data});
   if(updated.count!==1)throw Error('REWARD_VERSION_CONFLICT');
   const saved=await tx.crmReward.findUniqueOrThrow({where:{id:input.id},select:rewardMetadata});
   await tx.auditLog.create({data:{actor,action:'CRM_REWARD_SAVED',entityId:saved.id,details:{...metadata,imageVersion:saved.imageVersion,expiresAt:saved.expiresAt?.toISOString()??null}}});
   return saved;
  }
  const previous=await tx.crmReward.findUnique({where:{requestKey:input.requestKey},select:rewardMetadata});
  if(previous){
   if(previous.requestFingerprint!==requestFingerprint)throw Error('REWARD_REQUEST_CONFLICT');
   return previous;
  }
  const saved=await tx.crmReward.create({data:{requestKey:input.requestKey,requestFingerprint,...data},select:rewardMetadata});
  await tx.auditLog.create({data:{actor,action:'CRM_REWARD_SAVED',entityId:saved.id,details:{...metadata,imageVersion:saved.imageVersion,expiresAt:saved.expiresAt?.toISOString()??null}}});
  return saved;
 });
}

export async function redeemReward(customerCode:string,value:unknown){
 const result=redemptionInput.safeParse(value);
 if(!result.success)throw Error('INVALID_REDEMPTION');
 const input=result.data,code=canonicalCustomerCode(customerCode);
 return transaction(async tx=>{
  await userLock(tx,'crm-loyalty:'+code);
  const customer=await tx.customer.findUnique({where:{code}});
  if(!customer)throw Error('CUSTOMER_NOT_FOUND');
  if(customer.portalRegistrationPending)throw Error('CUSTOMER_PENDING');
  const previous=await tx.crmRewardRedemption.findUnique({where:{customerCode_requestKey:{customerCode:code,requestKey:input.requestKey}}});
  if(previous){
   if(previous.rewardId!==input.rewardId||previous.points!==input.expectedPoints||previous.rewardName!==input.expectedRewardName)throw Error('REDEMPTION_CONFLICT');
   return previous;
  }
  await userLock(tx,'crm-reward:'+input.rewardId);
  const reward=await tx.crmReward.findUnique({where:{id:input.rewardId},select:{id:true,name:true,points:true,availableUnits:true,enabled:true,expiresAt:true}});
  if(!reward)throw Error('REWARD_NOT_FOUND');
  if(!reward.enabled||reward.availableUnits<1)throw Error('REWARD_UNAVAILABLE');
  if(reward.expiresAt&&reward.expiresAt<=new Date())throw Error('REWARD_EXPIRED');
  if(reward.points!==input.expectedPoints||reward.name!==input.expectedRewardName)throw Error('REWARD_CHANGED');
  let delivery;
  try{delivery=portalProfile({name:customer.name,phone:customer.phone,address:customer.address});}
  catch{throw Error('INVALID_DELIVERY');}
  const summary=(await loadCustomerCrm([code],undefined,tx)).get(code)!;
  if(summary.availablePoints<reward.points)throw Error('INSUFFICIENT_POINTS');
  const reservationAt=new Date();
  const reserved=await tx.crmReward.updateMany({where:{id:reward.id,enabled:true,availableUnits:{gte:1},OR:[{expiresAt:null},{expiresAt:{gt:reservationAt}}]},data:{availableUnits:{decrement:1}}});
  if(reserved.count!==1)throw Error(reward.expiresAt&&reward.expiresAt<=reservationAt?'REWARD_EXPIRED':'REWARD_UNAVAILABLE');
  const redemption=await tx.crmRewardRedemption.create({data:{
   requestKey:input.requestKey,customerCode:code,rewardId:reward.id,rewardName:reward.name,points:reward.points,
   recipient:[customer.title,delivery.name].filter(Boolean).join(' '),phone:delivery.phone,address:delivery.address,
  }});
  await tx.auditLog.create({data:{actor:'customer',action:'CRM_REWARD_REDEEMED',entityId:redemption.id,details:{customerCode:code,rewardId:reward.id,points:reward.points}}});
  return redemption;
 });
}

export async function resolveRewardRedemption(actor:string,value:unknown){
 const result=resolutionInput.safeParse(value);
 if(!result.success)throw Error('INVALID_REDEMPTION_STATUS');
 const input=result.data;
 return transaction(async tx=>{
  const original=await tx.crmRewardRedemption.findUnique({where:{id:input.id}});
  if(!original)throw Error('REDEMPTION_NOT_FOUND');
  await userLock(tx,'crm-loyalty:'+original.customerCode);
  await userLock(tx,'crm-reward:'+original.rewardId);
  const current=await tx.crmRewardRedemption.findUniqueOrThrow({where:{id:original.id}});
  if(current.status===input.status)return current;
  if(current.status!=='PENDING')throw Error('REDEMPTION_RESOLVED');
  const updated=await tx.crmRewardRedemption.updateMany({where:{id:current.id,status:'PENDING'},data:{status:input.status,resolvedAt:new Date(),resolvedBy:actor}});
  if(updated.count!==1)throw Error('REDEMPTION_RESOLVED');
  if(input.status==='REJECTED')await tx.crmReward.update({where:{id:current.rewardId},data:{availableUnits:{increment:1}},select:{id:true}});
  await tx.auditLog.create({data:{actor,action:'CRM_REWARD_'+input.status,entityId:current.id,details:{rewardId:current.rewardId,customerCode:current.customerCode,points:current.points}}});
  return tx.crmRewardRedemption.findUniqueOrThrow({where:{id:current.id}});
 });
}
