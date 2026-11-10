import {admin,sameOrigin} from '@/lib/auth';
import {saveGmailConnection} from '@/lib/save-gmail-connection';
export async function POST(req:Request){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 return saveGmailConnection(req,actor);
}
