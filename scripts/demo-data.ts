import "./load-env";
import {db} from "../src/lib/db";
import {mockMode} from "../src/lib/config";
import {userKey} from "../src/lib/crypto";
import {recordLogin,review,webhook} from "../src/lib/tracking";
async function main(){
 if(!mockMode())throw new Error("Demo data requires development MOCK_MODE");
 const scenarios=[
 ["AFF001","pending","new"],["AFF001","approved","new"],["AFF001","paid","new"],
 ["AFF002","approved","new"],["AFF002","pending","new"],["AFF002","pending","existing"],
 ["AFF003","pending","unblocked"],["AFF003","pending","not-friend"]
 ];
 for(const [index,[code,decision,scenario]] of scenarios.entries()){
  const key=userKey("MOCK:demo-fixture-"+index);
  if(await db.conversion.findUnique({where:{userKey:key}}))continue;
  const a=await db.affiliate.findUniqueOrThrow({where:{code},include:{link:true}});
  const click=await db.click.create({data:{affiliateId:a.id,linkId:a.link!.id,source:"MOCK"}});
  if(scenario==="existing"||scenario==="unblocked")await webhook({id:"mock-fixture-event-"+index,key,type:"follow",at:new Date(Date.now()-(scenario==="existing"?86400000:0)),unblocked:scenario==="unblocked"});
  const c=await recordLogin(click.id,key,scenario!=="not-friend",scenario!=="existing");
  if(decision==="approved"||decision==="paid")await review(c.id,"approve","MOCK เท่านั้น: ตัวอย่างอนุมัติ ห้ามใช้จ่ายเงินจริง REF-"+index);
  if(decision==="paid")await review(c.id,"paid","MOCK เท่านั้น: ตัวอย่างบันทึกจ่าย ห้ามใช้จ่ายเงินจริง REF-"+index);
 }
 console.log("Prepared clearly labelled MOCK examples in local PostgreSQL.");
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.$disconnect());
