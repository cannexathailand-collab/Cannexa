import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {createDraftCustomer} from '../src/lib/draft-customer-identity';
import {summarizeVerifiedReferrals} from '../src/lib/referred-sales';
import {demoSalesRows} from '../src/lib/sales-demo';
import {isRecognizedSale} from '../src/lib/sales-report';
const originalTransaction=db.$transaction;
afterEach(()=>{db.$transaction=originalTransaction;});
test('creating a customer from employee drafts does not assign a referrer',async()=>{
 process.env.DATABASE_URL='postgresql://test:test@localhost/test?schema=public';
 let saved:any;
 const tx:any={$queryRawUnsafe:async()=>[],$queryRaw:async()=>[],customer:{findMany:async()=>[],create:async({data}:any)=>{saved=data;return {code:'CUS-00000001',...data};}},auditLog:{create:async()=>({})}};
 db.$transaction=(async(fn:any)=>fn(tx)) as any;
 await createDraftCustomer({name:'Buyer',phone:'0812345678'},{username:'seller',affiliateId:'seller-affiliate'});
 assert.equal(saved.referrerId,undefined);
});
test('referral summary requires both a verified customer and matching referrer',()=>{
 const base=demoSalesRows().filter(isRecognizedSale)[0];assert.ok(base);
 const customer=(code:string,referrerId:string|null)=>({code,legacy:false,referrerId,referrer:referrerId?{name:'Referrer',code:'REF'}:null,metaFbc:null});
 const rows=[{...base,id:'verified',customer:customer('verified','referrer'),affiliateId:'other-seller'}, {...base,id:'implicit',customer:customer('implicit','referrer')}, {...base,id:'seller-only',customer:customer('seller-only',null),affiliateId:'referrer'}];
 const result=summarizeVerifiedReferrals(rows,'referrer',new Set(['verified','seller-only']));
 assert.equal(result.count,1);assert.equal(result.rows[0].id,'verified');
});
