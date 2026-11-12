import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {admin,sameOrigin} from '@/lib/auth';
import {db,transaction} from '@/lib/db';
import {baseUrl} from '@/lib/config';
import {driveFolderId} from '@/lib/drive-connection';
export async function POST(request:Request){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 const form=await request.formData(),back=(status:string)=>NextResponse.redirect(baseUrl()+'/admin/drive?status='+status,303);
 try{await transaction(async tx=>{
  if(form.get('action')==='disconnect'){await tx.driveConnection.updateMany({where:{id:'active'},data:{encryptedToken:null,email:null,connectedAt:null,revision:randomUUID()}});await tx.driveOAuthAttempt.deleteMany({});}
  else await tx.driveConnection.update({where:{id:'active'},data:{folderId:driveFolderId(String(form.get('folder')??''))}});
  await tx.auditLog.create({data:{actor,action:form.get('action')==='disconnect'?'DRIVE_DISCONNECTED':'DRIVE_FOLDER_UPDATED',entityId:'active',details:{}}});
 });return back(form.get('action')==='disconnect'?'disconnected':'saved');}catch{return back('invalid-settings');}
}
