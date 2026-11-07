import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {employeeStock} from '../src/lib/employee-stock';
test('employee stock reads only the stored snapshot without waiting for Google or changing data',async t=>{
 const old=db.employeeStockSnapshot.findUnique,fetch=globalThis.fetch;
 t.after(()=>{db.employeeStockSnapshot.findUnique=old;globalThis.fetch=fetch;});
 globalThis.fetch=async()=>{assert.fail('employee page must not fetch a remote source');};
 const rows=[{code:'A1',name:'Product',available:30,remaining:50,prices:[]}],fetchedAt=new Date('2026-11-07T00:00:00Z');
 db.employeeStockSnapshot.findUnique=(async()=>({id:'active',rows,fetchedAt})) as any;
 const result=await employeeStock();assert.deepEqual(result.rows,rows);assert.equal(result.readAt,fetchedAt);
 db.employeeStockSnapshot.findUnique=(async()=>null) as any;
 assert.deepEqual((await employeeStock()).rows,[]);
});
