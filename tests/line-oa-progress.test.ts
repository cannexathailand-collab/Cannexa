import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {parseOaProgress,reportOaProgress,withOaProgress} from '../src/lib/line-oa-progress';
test('progress stays scoped to each job and keeps a bounded sequence of real steps',async t=>{
 const before=db.lineOaJob.updateMany;t.after(()=>{db.lineOaJob.updateMany=before;});
 const writes:any[]=[];(db.lineOaJob as any).updateMany=async(value:any)=>{writes.push(value);};
 await reportOaProgress('outside a job');assert.equal(writes.length,0);
 await Promise.all(['job-one','job-two'].map(id=>withOaProgress(id,[],async()=>{await reportOaProgress('ค้น '+id);await Promise.resolve();await reportOaProgress('บันทึก '+id);} )));
 for(const id of ['job-one','job-two']){
  const saved=writes.filter(write=>write.where.id===id).at(-1);
  assert.deepEqual(saved.data.progressLog.map((step:any)=>step.message),['ค้น '+id,'บันทึก '+id]);
  assert.equal(saved.where.status,'RUNNING');
 }
 assert.equal(parseOaProgress(Array.from({length:100},(_,i)=>({at:String(i),message:'step'}))).length,60);
 assert.deepEqual(parseOaProgress([{message:'missing time'},{at:'now',message:1}]),[]);
});
