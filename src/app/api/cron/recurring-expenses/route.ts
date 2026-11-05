import {equal} from '@/lib/crypto';import {generateRecurringExpenses} from '@/lib/recurring-expenses';
export const maxDuration=60;
export async function GET(req:Request){const secret=process.env.CRON_SECRET;if(!secret||secret.length<32)return new Response('Cron not configured',{status:503});if(!equal(req.headers.get('authorization')??'','Bearer '+secret))return new Response('Forbidden',{status:403});try{return Response.json({ok:true,...await generateRecurringExpenses('recurring-expense-cron')});}catch{return new Response('Recurring expense processing failed',{status:503});}}
