import {equal} from '@/lib/crypto';
import {closeStockDay} from '@/lib/stock-history';
export const maxDuration=60;
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<32)return new Response('Cron not configured',{status:503});
 if(!equal(req.headers.get('authorization')??'','Bearer '+secret))return new Response('Forbidden',{status:403});
 try{return Response.json({ok:true,...await closeStockDay('stock-history-cron')});}
 catch{return Response.json({ok:false,error:'บันทึกยอดปิดยังไม่ครบ สามารถลองใหม่จากหน้าประวัติสต๊อกได้'},{status:503});}
}
