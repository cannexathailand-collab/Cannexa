import {test} from "node:test";
import assert from "node:assert/strict";
import {db} from "../src/lib/db";
import {matchShipments} from "../src/lib/gmail-reports";
import {shipmentCandidates,quotedTotal,moneySatang,compatibleCodCandidates,compatibleAddress} from "../src/lib/shipment-matching";
const recipient={recipient:"ทดสอบ",phone:"0812345678",address:"1 ต.ราไวย์ อ.เมือง จ.ภูเก็ต 83130"};
const order=(id:string,affiliateId="seller")=>({id,affiliateId,...recipient,payment:"COD",status:"WAITING_SHIPMENT",rawText:"ยอดตามข้อความ: 2,560",salesCommissionBasis:"REVENUE",salesCommissionBps:1000});
test("matching requires recipient phone address and total, never guesses transfer COD zero",()=>{
 const shipment={...recipient,codSatang:256000};assert.equal(shipmentCandidates(shipment,[order("a")]).length,1);
 for(const changed of [{phone:"0811111111"},{recipient:"คนอื่น"},{address:"คนละบ้าน"},{codSatang:100},{codSatang:0}])assert.equal(shipmentCandidates({...shipment,...changed},[order("a")]).length,0);
 assert.equal(shipmentCandidates(shipment,[{...order("a"),payment:"โอน"}]).length,0);
 assert.equal(quotedTotal("ยอดรวม: 100\nCOD: 100"),null);assert.equal(moneySatang("2,560.25"),256025);
});
function harness(t:any,conflict=false){const original=db.$transaction;t.after(()=>{db.$transaction=original;});const orders=[order("a"),order("b",conflict?"other-seller":"seller")];const shipments=[{tracking:"TRACK0001",...recipient,codSatang:256000,orderId:null,status:"WAITING_ORDER"},{tracking:"TRACK0002",...recipient,codSatang:256000,orderId:null,status:"WAITING_ORDER"}];const sales:any[]=[];
 const receipts=shipments.map(s=>({tracking:s.tracking,amountSatang:s.codSatang}));
 const tx:any={$queryRawUnsafe:async()=>[],codReceipt:{findMany:async()=>receipts},shipment:{findUnique:async({where}:any)=>shipments.find(s=>s.orderId===where.orderId),updateMany:async({where,data}:any)=>{const selected=shipments.filter(s=>where.tracking.in.includes(s.tracking)&&!s.orderId);selected.forEach(s=>Object.assign(s,data));return {count:selected.length};},findMany:async({where}:any)=>where.status?.in?shipments.filter(s=>where.status.in.includes(s.status)):shipments.filter(s=>!["RETURNED","CANCELLED"].includes(s.status)&&(!s.orderId||["MATCHED_WAITING_COD","MATCHED_COD_AMOUNT_MISMATCH"].includes(s.status))),update:async({where,data}:any)=>Object.assign(shipments.find(s=>s.tracking===where.tracking)!,data)},orderIntake:{findMany:async({where}:any)=>orders.filter(o=>typeof where.status==="string"?o.status===where.status:where.status.in.includes(o.status)),update:async({where,data}:any)=>Object.assign(orders.find(o=>o.id===where.id)!,data)},affiliate:{findUnique:async()=>({active:true,archivedAt:null})},salesOrder:{findUnique:async({where}:any)=>sales.find(s=>s.orderId===where.orderId),update:async({where,data}:any)=>Object.assign(sales.find(s=>s.id===where.id),data),create:async({data}:any)=>{assert.ok(!sales.some(s=>s.tracking===data.tracking||s.orderId===data.orderId));sales.push(data);}},auditLog:{create:async()=>{}}};db.$transaction=(async(fn:any)=>fn(tx)) as any;return {orders,shipments,sales,receipts};}
test("two identical orders and two distinct parcels produce two one-to-one sales, rerun posts nothing",async t=>{const h=harness(t);assert.equal((await matchShipments("owner")).matched,2);assert.equal(h.sales.length,2);assert.notEqual(h.sales[0].orderId,h.sales[1].orderId);assert.equal(h.sales[0].commissionSatang,25600);assert.equal((await matchShipments("owner")).matched,0);});
test("same matching details assigned to different sellers are not auto-credited",async t=>{const h=harness(t,true);assert.equal((await matchShipments("owner")).matched,0);assert.equal(h.sales.length,0);assert.ok(h.shipments.every(s=>s.status==="AMBIGUOUS_SELLER"));});
test("profit commission waits for actual stock costs",async t=>{const h=harness(t);h.orders[0].salesCommissionBasis="PROFIT";await matchShipments("owner");assert.equal(h.sales[0].commissionSatang,null);assert.equal(h.sales[0].status,"WAITING_COST");});
test('gross profit COD never posts revenue-based commission while waiting for costs',async t=>{const h=harness(t);h.orders[0].salesCommissionBasis='GROSS_PROFIT';await matchShipments('owner');assert.equal(h.sales[0].commissionBasis,'GROSS_PROFIT');assert.equal(h.sales[0].commissionSatang,null);assert.equal(h.sales[0].status,'WAITING_COST');});
test("shipment without COD receipt cannot credit commission; later receipt unlocks one sale",async t=>{const h=harness(t);h.receipts.splice(0);let result=await matchShipments("owner");assert.equal(result.matched,0);assert.equal(result.waitingCod,2);assert.equal(h.sales.length,0);h.receipts.push({tracking:"TRACK0001",amountSatang:256000});result=await matchShipments("owner");assert.equal(result.matched,1);assert.equal(h.sales[0].paymentEvidence,"COD_RECEIPT");assert.equal(h.sales.length,1);assert.equal((await matchShipments("owner")).matched,0);});
test("COD amount mismatch stays review-only even when customer details match",async t=>{const h=harness(t);h.receipts.forEach(r=>r.amountSatang=100);const result=await matchShipments("owner");assert.equal(result.amountMismatch,2);assert.equal(h.sales.length,0);assert.ok(h.shipments.every(s=>s.status==="MATCHED_COD_AMOUNT_MISMATCH"));});
test("zero COD parcel links an already paid transfer without adding revenue or commission",async t=>{
 const h=harness(t);h.orders.splice(1);h.shipments.splice(1);h.orders[0].payment="โอน";h.orders[0].status="TRANSFER_RECORDED";h.shipments[0].codSatang=0;h.receipts.splice(0);
 h.sales.push({id:"existing-sale",orderId:"a",paymentMethod:"TRANSFER",status:"PAID",tracking:null,revenueSatang:256000,commissionSatang:25600,paidAmountSatang:25600});
 assert.equal((await matchShipments("owner")).transferMatched,1);assert.equal(h.sales.length,1);assert.equal(h.sales[0].status,"PAID");assert.equal(h.sales[0].revenueSatang,256000);assert.equal(h.sales[0].commissionSatang,25600);assert.equal(h.sales[0].tracking,"TRACK0001");assert.equal((await matchShipments("owner")).transferMatched,0);
});
test("zero COD parcel cannot create a zero-valued sale or credit a claim",async t=>{const h=harness(t);h.shipments.forEach(s=>s.codSatang=0);h.orders.forEach(o=>{o.payment="เคลม";o.status="CLAIM_WAITING_COST";});const result=await matchShipments("owner");assert.equal(result.transferMatched,0);assert.equal(h.sales.length,0);assert.ok(h.shipments.every(s=>s.status==="AMBIGUOUS_NON_COD"));});
const shortAddress="หมู่บ้านทดสอบริมแม่น้ำบ้านเลขที่28";
test("compatible matching allows y/ie spelling and substantial address prefix but preserves exact phone and amount",()=>{
 const o={...order("a"),recipient:"OBY",address:shortAddress};const s={...recipient,recipient:"Obie",address:shortAddress+" ตำบลทดสอบ จังหวัดทดสอบ 11000",codSatang:256000};
 assert.equal(shipmentCandidates(s,[o]).length,0);assert.equal(compatibleCodCandidates(s,[o]).length,1);
 assert.equal(compatibleCodCandidates({...s,phone:"0811111111"},[o]).length,0);assert.equal(compatibleCodCandidates({...s,codSatang:256001},[o]).length,0);assert.equal(compatibleCodCandidates({...s,recipient:"Other"},[o]).length,0);
 assert.equal(compatibleAddress(shortAddress,shortAddress+"0 เพิ่มเติม"),false);assert.equal(compatibleAddress(shortAddress,shortAddress+"/1 เพิ่มเติม"),false);assert.equal(compatibleAddress("ถนนทดสอบ", "ถนนทดสอบยาวขึ้น"),false);
});
test("one compatible verified COD pair credits once and records no duplicate on retry",async t=>{
 const h=harness(t);h.orders.splice(1);h.shipments.splice(1);h.orders[0].recipient="OBY";h.orders[0].address=shortAddress;h.shipments[0].recipient="Obie";h.shipments[0].address=shortAddress+" ตำบลทดสอบ 11000";
 assert.equal((await matchShipments("owner")).matched,1);assert.equal(h.sales.length,1);assert.equal(h.sales[0].commissionSatang,25600);assert.equal((await matchShipments("owner")).matched,0);
});
test("compatible matching refuses multiple plausible orders or parcels",async t=>{
 const h=harness(t);h.orders.forEach(o=>{o.recipient="OBY";o.address=shortAddress;});h.shipments.forEach(s=>{s.recipient="Obie";s.address=shortAddress+" ตำบลทดสอบ 11000";});
 assert.equal((await matchShipments("owner")).matched,0);assert.equal(h.sales.length,0);
 h.orders.splice(1);assert.equal((await matchShipments("owner")).matched,0);assert.equal(h.sales.length,0);
 h.receipts.splice(1);assert.equal((await matchShipments("owner")).matched,0);assert.equal(h.sales.length,0);
});
test("Thai dispatch prefix and repeated administrative fields normalize without changing house road or postcode",()=>{
 const address="435/53 ถ.ทดสอบ1 ต.ในเมือง อ.เมือง จ.บุรีรัมย์ 31000";
 const report="435/53 ถ.ทดสอบ1 ในเมือง เมืองบุรีรัมย์ บุรีรัมย์ 31000 ในเมือง เมืองบุรีรัมย์ บุรีรัมย์ 31000";
 const o={...order("a"),recipient:"ส่งน.ส.ลูกค้า ทดสอบ",address};const s={...recipient,recipient:"น.ส.ลูกค้า ทดสอบ",address:report,codSatang:256000};
 assert.equal(compatibleCodCandidates(s,[o]).length,1);
 for(const changed of [report.replaceAll("31000","31001"),report.replace("435/53","435/54"),report.replace("ทดสอบ1","ทดสอบ2")])assert.equal(compatibleCodCandidates({...s,address:changed},[o]).length,0);
 assert.equal(compatibleCodCandidates({...s,recipient:"น.ส.คนอื่น ทดสอบ"},[o]).length,0);
});
test("shipping link is recorded before payment, later receipt credits by the same tracking",async t=>{
 const h=harness(t);h.orders.splice(1);h.shipments.splice(1);h.receipts.splice(0);
 const first=await matchShipments("owner");assert.equal(first.shipmentLinked,1);assert.equal(first.matched,0);assert.equal(h.shipments[0].orderId,"a");assert.equal(h.orders[0].status,"MATCHED_SHIPMENT_WAITING_COD");assert.equal(h.sales.length,0);
 h.orders[0].recipient="ชื่อถูกแก้หลังผูกพัสดุ";h.receipts.push({tracking:"TRACK0001",amountSatang:256000});
 assert.equal((await matchShipments("owner")).matched,1);assert.equal(h.sales[0].tracking,"TRACK0001");assert.equal((await matchShipments("owner")).matched,0);
});
test("returned linked parcel never creates a sale even if an old COD receipt exists",async t=>{
 const h=harness(t);h.orders.splice(1);h.shipments.splice(1);h.orders[0].status="RETURNED";Object.assign(h.shipments[0],{orderId:"a",status:"RETURNED"});
 assert.equal((await matchShipments("owner")).matched,0);assert.equal(h.sales.length,0);assert.equal(h.shipments[0].status,"RETURNED");
});
test("claim links to its parcel without creating sales or commission and still awaits inventory cost",async t=>{
 const h=harness(t);h.orders.splice(1);h.shipments.splice(1);h.orders[0].payment="เคลม";h.orders[0].status="CLAIM_WAITING_COST";h.shipments[0].codSatang=0;h.receipts.splice(0);
 assert.equal((await matchShipments("owner")).claimMatched,1);assert.equal(h.shipments[0].orderId,"a");assert.equal(h.shipments[0].status,"MATCHED_CLAIM");assert.equal(h.orders[0].status,"CLAIM_WAITING_COST");assert.equal(h.sales.length,0);assert.equal((await matchShipments("owner")).claimMatched,0);
});
test("resubmitted order cannot consume an older paid parcel when a newer returned parcel matches",async t=>{
 const h=harness(t);h.orders.splice(1);h.shipments.splice(1);Object.assign(h.shipments[0],{reportAt:new Date('2026-10-10')});
 h.shipments.push({...h.shipments[0],tracking:"NEWRETURN",status:"RETURNED",reportAt:new Date('2026-10-30')} as any);
 assert.equal((await matchShipments("owner")).matched,0);assert.equal(h.sales.length,0);assert.equal(h.shipments[0].status,"NEWER_RETURNED_OR_CANCELLED_PARCEL");
});
test("substantial named villa prefix requires exact full name, phone, amount and a numbered full report address",()=>{
 const o={...order("a"),recipient:"Example Customer",address:"Golden Melody Villa"};const s={...recipient,recipient:"Example Customer",address:"Golden Melody Villa 37 ซ. 1 อ่าวนาง เมืองกระบี่ กระบี่ 81000",codSatang:256000};
 assert.equal(compatibleCodCandidates(s,[o]).length,1);
 for(const changed of [{recipient:"Someone Customer"},{phone:"0811111111"},{codSatang:256001},{address:s.address.replace("Villa 37","Villas 37")},{address:s.address.replace("37 ","")},{address:s.address.replace("81000","")}])assert.equal(compatibleCodCandidates({...s,...changed},[o]).length,0);
 assert.equal(compatibleCodCandidates({...s,recipient:"OBY"},[{...o,recipient:"OBY"}]).length,0);
 assert.equal(compatibleCodCandidates({...s,address:"Golden Villa 37 กระบี่ 81000"},[{...o,address:"Golden Villa"}]).length,0);
});

test("COD receipts arriving after a rate change still use each order original commission snapshot",async t=>{
 const h=harness(t);h.orders[0].salesCommissionBps=200;h.orders[1].salesCommissionBps=100;h.receipts.splice(0);await matchShipments("owner");assert.equal(h.sales.length,0);
 h.receipts.push(...h.shipments.map(s=>({tracking:s.tracking,amountSatang:s.codSatang})));await matchShipments("owner");
 assert.deepEqual(h.sales.map(s=>s.commissionBps),[200,100]);assert.deepEqual(h.sales.map(s=>s.commissionSatang),[5120,2560]);await matchShipments("owner");assert.equal(h.sales.length,2);assert.deepEqual(h.sales.map(s=>s.commissionSatang),[5120,2560]);
});
