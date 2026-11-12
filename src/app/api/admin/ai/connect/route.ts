import {admin,sameOrigin} from '@/lib/auth';
import {saveOpenAiConnection} from '@/lib/openai-connection';
export async function POST(request:Request){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 let status='saved';try{const form=await request.formData();await saveOpenAiConnection(actor,{key:form.get('key'),model:form.get('model')});}catch(e){status=e instanceof Error&&e.message==='OPENAI_KEY_REJECTED'?'key':e instanceof Error&&e.message==='OPENAI_MODEL_UNAVAILABLE'?'model':'failed';}
 return Response.redirect(new URL('/admin/ai?status='+status,request.url),303);
}
