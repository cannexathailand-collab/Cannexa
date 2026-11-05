import "./load-env";
import {db,transaction} from "../src/lib/db";
async function main(){
 const days=Number(process.env.RETENTION_DAYS??180);if(!Number.isInteger(days)||days<30)throw new Error("RETENTION_DAYS must be >=30");
 const cutoff=new Date(Date.now()-days*86400000);
 await transaction(async tx=>{
 const oauth=await tx.oAuthAttempt.deleteMany({where:{expiresAt:{lt:new Date()}}});
 const history=await tx.statusHistory.deleteMany({where:{createdAt:{lt:cutoff}}});
 // Conversion + hashed identity remain as the deduplication/financial registry.
 const clicks=await tx.click.deleteMany({where:{createdAt:{lt:cutoff},conversion:{is:null},oauth:{none:{}}}});
 const limits=await tx.rateLimit.deleteMany({where:{expiresAt:{lt:new Date()}}});
 await tx.orderIntake.updateMany({where:{createdAt:{lt:cutoff},rawText:{not:null}},data:{rawText:null,recipient:null,phone:null,address:null,senderKey:null,status:"EXPIRED",issues:[]}});
 await tx.auditLog.create({data:{actor:"retention",action:"RETENTION_CLEANUP",entityId:"system",details:{cutoff:cutoff.toISOString(),oauth:oauth.count,history:history.count,clicks:clicks.count,limits:limits.count}}});
 });
 console.log("Retention done. Minimal webhook history is retained for anti-duplication; no raw LINE ID stored.");
}
main().finally(()=>db.$disconnect());
