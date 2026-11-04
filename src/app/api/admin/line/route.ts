import {admin,sameOrigin} from "@/lib/auth";
import {saveLineConnection} from "@/lib/save-line-connection";
export async function POST(req:Request){
 try{await admin();await sameOrigin();}catch{return new Response("Forbidden",{status:403});}
 return saveLineConnection(req);
}
