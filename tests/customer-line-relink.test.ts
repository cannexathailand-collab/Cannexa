import assert from 'node:assert/strict';
import {test} from 'node:test';
import {db} from '../src/lib/db';
import {customerLineRevocationId,resetCustomerLineLinks} from '../src/lib/customer-line-relink';
import {linkPortalCustomer} from '../src/lib/customer-portal';

test('old LINE sessions cannot recreate a customer after an administrative unlink',async t=>{
 const original=db.$transaction;t.after(()=>{db.$transaction=original;});
 const key='a'.repeat(64);
 db.$transaction=((work:any)=>work({$queryRawUnsafe:async()=>[],customer:{findUnique:async()=>null},auditLog:{findUnique:async({where}:any)=>{assert.equal(where.id,customerLineRevocationId(key));return {id:where.id};}}})) as typeof original;
 await assert.rejects(linkPortalCustomer(key),/LINE_RELINK_REQUIRED/);
});

test('reset keeps customer fields intact and issues separate single-use links',async t=>{
 process.env.APP_URL??='https://example.test';const original=db.$transaction;t.after(()=>{db.$transaction=original;});
 const rows=[{code:'CUS-00000422',lineUserKey:'a'.repeat(64),conversionId:null,name:'One',phone:'0812345678'}, {code:'CUS-00000423',lineUserKey:'b'.repeat(64),conversionId:null,name:'Two',phone:'0898765432'}];
 const links:any[]=[],revoked:any[]=[],changes:any[]=[];
 const tx={$queryRawUnsafe:async()=>[],customer:{findUniqueOrThrow:async({where}:any)=>rows.find(row=>row.code===where.code),update:async({where,data}:any)=>{changes.push(data);return Object.assign(rows.find(row=>row.code===where.code)!,data);}},conversion:{findUnique:async()=>null},customerAccessLink:{findMany:async()=>[{tokenHash:'old'}],deleteMany:async()=>{},create:async({data}:any)=>links.push(data)},oAuthAttempt:{deleteMany:async({where}:any)=>assert.deepEqual(where.customerLinkHash.in,['old'])},auditLog:{upsert:async({create}:any)=>revoked.push(create),create:async()=>{}}};
 db.$transaction=((work:any)=>work(tx)) as typeof original;
 const result=await resetCustomerLineLinks('owner',rows.map(row=>({code:row.code,expectedLineUserKey:row.lineUserKey})));
 assert.equal(result.length,2);assert.notEqual(result[0].url,result[1].url);assert.ok(links.every(link=>link.expiresAt===null));
 assert.deepEqual(changes,[{lineUserKey:null},{lineUserKey:null}]);assert.equal(rows[0].name,'One');assert.equal(rows[1].phone,'0898765432');assert.equal(revoked.length,2);
});

test('reset rejects an identity that changed after review',async t=>{
 const original=db.$transaction;t.after(()=>{db.$transaction=original;});
 db.$transaction=((work:any)=>work({$queryRawUnsafe:async()=>[],customer:{findUniqueOrThrow:async()=>({lineUserKey:'b'.repeat(64)})}})) as typeof original;
 await assert.rejects(resetCustomerLineLinks('owner',[{code:'C0422',expectedLineUserKey:'a'.repeat(64)}]),/CUSTOMER_LINE_CHANGED/);
});
