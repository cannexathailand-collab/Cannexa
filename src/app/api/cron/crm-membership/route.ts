import {equal} from '@/lib/crypto';
import {crmTierReport} from '@/lib/crm-tier-report';
export const maxDuration=60;
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<32)return new Response('Cron not configured',{status:503});
 if(!equal(req.headers.get('authorization')??'','Bearer '+secret))return new Response('Forbidden',{status:403});
 try{const result=await crmTierReport();return Response.json({ok:true,customers:result.tiers.size});}
 catch{return new Response('Membership review failed',{status:503});}
}
