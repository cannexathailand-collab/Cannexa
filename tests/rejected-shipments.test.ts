import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {matchingRejectedOrders,recordRejectedShipmentMatches} from '../src/lib/rejected-shipments';

const row={tracking:'TESTTRACK123',recipient:'Changed name',phone:'+66 81 234 5678',amountSatang:125000};
const rejection={id:'rejected',createdAt:new Date('2026-11-09T00:00:00Z'),details:{phone:'0812345678',amountSatang:125000,reasons:['สินค้า NT18 ไม่พอ']}};

test('rejected shipment review requires matching phone and total, ignores missing historical context',()=>{
 assert.equal(matchingRejectedOrders(row,[rejection]).length,1);
 assert.deepEqual(matchingRejectedOrders({...row,amountSatang:125001},[rejection]),[]);
 assert.deepEqual(matchingRejectedOrders({...row,phone:'0898765432'},[rejection]),[]);
 assert.deepEqual(matchingRejectedOrders({...row,amountSatang:undefined},[rejection]),[]);
 assert.deepEqual(matchingRejectedOrders(row,[{...rejection,details:{reasons:['สินค้าไม่พอ']}}]),[]);
});

test('recording shipment review retains telephone and tracking, deduplicates repeated uploads',async t=>{
 const original=db.auditLog.createMany;
 t.after(()=>{db.auditLog.createMany=original;});
 const calls:any[]=[];
 db.auditLog.createMany=(async(args:any)=>{calls.push(args);return {count:1};}) as typeof original;
 const rows=[{...row,rejectedOrders:matchingRejectedOrders(row,[rejection])}];
 await recordRejectedShipmentMatches('owner','first.xlsx',rows);
 await recordRejectedShipmentMatches('owner','again.xlsx',rows);
 assert.equal(calls[0].skipDuplicates,true);
 assert.equal(calls[0].data[0].id,calls[1].data[0].id);
 assert.equal(calls[0].data[0].details.tracking,row.tracking);
 assert.equal(calls[0].data[0].details.phone,row.phone);
 assert.equal(calls[0].data[0].details.status,'NEEDS_REVIEW');
 assert.deepEqual(calls[0].data[0].details.reasons,rejection.details.reasons);
 await recordRejectedShipmentMatches('owner','empty.xlsx',[{...row,rejectedOrders:[]}]);
 assert.equal(calls.length,2);
});
