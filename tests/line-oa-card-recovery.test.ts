import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withDatabase} from '../src/lib/db';
import {saveManagerCards,cardSetSourceFingerprint} from '../src/lib/line-oa-manager';
const set:any={title:'Test cups',products:[{code:'CUP1',name:'Blue cup',description:'Reusable cup',keyword:'CUP1',replyTitle:'ข้อมูล CUP1',linkUrl:'https://example.com/cup',images:[1,2,3].map(slot=>({slot,url:'https://example.com/image'}))}]};
function data(){
 let bytes=Buffer.from('original image');const writes:any[]=[];
 const image=async()=>({imageMime:'image/jpeg',imageData:bytes});
 const fake:any={stockProductImage:{findUnique:image},stockProductExtraImage:{findUnique:image},lineOaArtifact:{findUnique:async()=>null,upsert:async(input:any)=>{writes.push(input);return input.create;},deleteMany:async(input:any)=>{writes.push(input);return {count:1};}}};fake.$transaction=async(fn:any)=>fn(fake);
 return {fake,writes,changeImage:()=>{bytes=Buffer.from('changed image');}};
}
function page(){
 let uploads=0;const values:Record<string,string>={'ใส่ชื่อไอเทม':set.title,'ใส่ข้อความแท็ก':'CUP1','ข้อความในช่องนี้จะถูกส่งไปทางแชท':'CUP1','ใส่ชื่อการ์ด':'Blue cup','ใส่คำอธิบาย':'Reusable cup','ใส่ลิงก์':'https://example.com/cup'};
 const field=(name:string,index=0):any=>({waitFor:async()=>{},inputValue:async()=>name==='ใส่ข้อความสำหรับป้ายแอ็กชัน'?(index?'Open Link':'Show details'):values[name],nth:(i:number)=>field(name,i),fill:async()=>{uploads++;throw Error('must not rewrite');}});
 const tabs:any={first:()=>({waitFor:async()=>{}}),count:async()=>1,nth:()=>({click:async()=>{}})};
 const p:any={url:()=> 'https://manager.line.biz/account/@test/cardtypemessage/edit/123',goto:async()=>{},getByPlaceholder:field,getByText:()=>{throw Error('rewrite attempted');},getByRole:(role:string,{name}:{name:string})=>role==='checkbox'?{isChecked:async()=>name!=='ราคา'}:{count:async()=>3},locator:(selector:string)=>selector==='main a.nav-link'?tabs:{inputValue:async()=>'3'}};
 return {p,get uploads(){return uploads;}};
}
test('a saved but unconfirmed card set is verified and promoted without re-uploading',async()=>{
 const d=data(),ui=page();await withDatabase(d.fake,async()=>{
  const fingerprint=await cardSetSourceFingerprint(set);d.fake.lineOaArtifact.findUnique=async({where}:any)=>where.account_kind_key.kind==='cards-pending'?{remoteId:'123',fingerprint}:null;
  const result=await saveManagerCards(ui.p,'@test',set);
  assert.equal(result.url,'https://manager.line.biz/account/@test/cardtypemessage/edit/123');assert.equal(ui.uploads,0);
  assert.equal(d.writes[0].create.kind,'cards');assert.equal(d.writes[0].create.fingerprint,fingerprint);assert.equal(d.writes[1].where.kind,'cards-pending');
 });
});
test('changing image bytes invalidates a saved card fingerprint even if its URL is unchanged',async()=>{
 const d=data();await withDatabase(d.fake,async()=>{const old=await cardSetSourceFingerprint(set);d.changeImage();assert.notEqual(await cardSetSourceFingerprint(set),old);});
});
test('an unreadable saved field is never marked as verified',async()=>{
 const d=data(),ui=page();await withDatabase(d.fake,async()=>{
  const fingerprint=await cardSetSourceFingerprint(set);d.fake.lineOaArtifact.findUnique=async()=>({remoteId:'123',fingerprint});
  const original=ui.p.getByPlaceholder;ui.p.getByPlaceholder=(name:string)=>name==='ใส่คำอธิบาย'?{inputValue:async()=>{throw Error('READ_FAILED');}}:original(name);
  await assert.rejects(saveManagerCards(ui.p,'@test',set),/READ_FAILED/);assert.equal(d.writes.length,0);
 });
});
