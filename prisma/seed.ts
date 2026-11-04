import "../scripts/load-env";
import {db} from "../src/lib/db";
import {mockMode} from "../src/lib/config";
async function main(){
 if(!mockMode())throw new Error("Seed is allowed only in development MOCK_MODE");
 for(const [code,name] of [["AFF001","ทีมหน้าร้าน"],["AFF002","ทีมกิจกรรม"],["AFF003","พาร์ทเนอร์"]]){
 await db.affiliate.upsert({where:{code},create:{code,name,rateSatang:500,notes:"MOCK · ข้อมูลตัวอย่าง",link:{create:{}}},update:{}});
 }
 console.log("Seeded 3 MOCK affiliates; no fabricated LINE conversions.");
}
main().finally(()=>db.$disconnect());
