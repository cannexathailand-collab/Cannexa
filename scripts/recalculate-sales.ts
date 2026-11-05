import {db,transaction,userLock} from '../src/lib/db';
import {recalculateSalesRecognition} from '../src/lib/sales-recognition';
import {salesReport} from '../src/lib/sales-report';
const policy='actual-dispatch-and-cod-receipt-v1';
async function main(){
 const existing=await db.auditLog.findFirst({where:{action:'SALES_POLICY_RECALCULATED',entityId:policy}});
 const before=await db.salesOrder.findMany({select:{id:true,orderId:true,tracking:true,status:true,revenueSatang:true,recognizedAt:true}});
 const result=await recalculateSalesRecognition('sales-policy-backfill');
 const after=await db.salesOrder.findMany({select:{id:true,recognizedAt:true,revenueSatang:true,status:true}});
 if(!existing)await transaction(async tx=>{await userLock(tx,'sales-policy:'+policy);if(await tx.auditLog.findFirst({where:{action:'SALES_POLICY_RECALCULATED',entityId:policy}}))return;await tx.auditLog.create({data:{actor:'sales-policy-backfill',action:'SALES_POLICY_RECALCULATED',entityId:policy,details:{rule:'TRANSFER: actual dispatch; COD: actual dispatch plus exact tracking receipt; recognized on Bangkok dispatch day; exclude claims/cancellations/returns',records:before.map(b=>({saleId:b.id,orderId:b.orderId,tracking:b.tracking,previousStatus:b.status,previousDeclaredRevenueSatang:b.revenueSatang,previousRecognizedAt:b.recognizedAt?.toISOString()??null,recognizedAt:after.find(a=>a.id===b.id)?.recognizedAt?.toISOString()??null})),...result}}});});
 const report=await salesReport();console.log(JSON.stringify({...result,recognizedSalesCount:report.summary.count,recognizedRevenueSatang:report.summary.revenueSatang,historyAlreadyRecorded:!!existing}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
