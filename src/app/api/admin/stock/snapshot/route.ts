import {admin,sameOrigin} from '@/lib/auth';
import {syncEmployeeStock} from '@/lib/employee-stock-sync';
export const maxDuration=60;
export async function POST(){
 try{await sameOrigin();await admin();}catch{return new Response('Forbidden',{status:403});}
 try{return Response.json(await syncEmployeeStock());}catch{return Response.json({error:'Sync failed'},{status:503});}
}
