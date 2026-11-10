import {admin,sameOrigin} from '@/lib/auth';
import {saveUserAccount} from '@/lib/save-user-account';
export async function POST(req:Request){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 return saveUserAccount(req,actor);
}
