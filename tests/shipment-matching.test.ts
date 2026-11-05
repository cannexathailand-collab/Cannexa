import {test} from "node:test";
import assert from "node:assert/strict";
import {db} from "../src/lib/db";
import {matchShipments} from "../src/lib/gmail-reports";
import {shipmentCandidates,quotedTotal,moneySatang} from "../src/lib/shipment-matching";
const recipient={recipient:"ทดสอบ",phone:"0812345678",address:"1 ต.ราไวย์ อ.เมือง จ.ภูเก็ต 83130"};
const order=(id:string,affiliateId="seller")=>({id,affiliateId,...recipient,payment:"COD",status:"WAITING_SHIPMENT",rawText:"ยอดตามข้อความ: 2,560",salesCommissionBasis:"REVENUE",salesCommissionBps:1000});
test("matching requires recipient phone address and total, never guesses transfer COD zero",()=>{
 const shipment={...recipient,codSatang:256000};assert.equal(shipmentCandidates(shipment,[order("a")]).length,1);
 for(const changed of [{phone:"0811111111"},{recipient:"คนอื่น"},{address:"คนละบ้าน"},{codSatang:100},{codSatang:0}])assert.equal(shipmentCandidates({...shipment,...changed},[order("a")]).length,0);
 assert.equal(shipmentCandidates(shipment,[{...order("a"),payment:"โอน"}]).length,0);
 assert.equal(quotedTotal("ยอดรวม: 100\nCOD: 100"),null);assert.equal(moneySatang("2,560.25"),256025);
});
function harness(t:any,conflict=false){const original=db.$transaction;t.after(()=>{db.$transaction=original;});const orders=[order("a"),order("b",conflict?"other-seller":"seller")];const shipments=[{tracking:"TRACK0001",...recipient,codSatang:256000,orderId:null,status:"WAITING_ORDER"},{tracking:"TRACK0002",...recipient,codSatang:256000,orderId:null,status:"WAITING_ORDER"}];const sales:any[]=[];
 const tx:any={$queryRawUnsafe:async()=>[],shipment:{findMany:async()=>shipments.filter(s=>!s.orderId),update:async({where,data}:any)=>Object.assign(shipments.find(s=>s.tracking===where.tracking)!,data)},orderIntake:{findMany:async()=>orders.filter(o=>o.status==="WAITING_SHIPMENT"),update:async({where,data}:any)=>Object.assign(orders.find(o=>o.id===where.id)!,data)},affiliate:{findUnique:async()=>({active:true,archivedAt:null})},salesOrder:{create:async({data}:any)=>{assert.ok(!sales.some(s=>s.tracking===data.tracking||s.orderId===data.orderId));sales.push(data);}},auditLog:{create:async()=>{}}};db.$transaction=(async(fn:any)=>fn(tx)) as any;return {orders,shipments,sales};}
test("two identical orders and two distinct parcels produce two one-to-one sales, rerun posts nothing",async t=>{const h=harness(t);assert.equal((await matchShipments("owner")).matched,2);assert.equal(h.sales.length,2);assert.notEqual(h.sales[0].orderId,h.sales[1].orderId);assert.equal(h.sales[0].commissionSatang,25600);assert.equal((await matchShipments("owner")).matched,0);});
test("same matching details assigned to different sellers are not auto-credited",async t=>{const h=harness(t,true);assert.equal((await matchShipments("owner")).matched,0);assert.equal(h.sales.length,0);assert.ok(h.shipments.every(s=>s.status==="AMBIGUOUS_SELLER"));});
test("profit commission waits for actual stock costs",async t=>{const h=harness(t);h.orders[0].salesCommissionBasis="PROFIT";await matchShipments("owner");assert.equal(h.sales[0].commissionSatang,null);assert.equal(h.sales[0].status,"WAITING_COST");});
