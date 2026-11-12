import {mkdtemp,open,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {db} from './db';
import {driveAccess} from './drive-connection';

export const maxDriveVideoBytes=200*1024*1024;
export type DriveVideo={id:string;name:string;mimeType:string;size:string;modifiedTime?:string;md5Checksum?:string;capabilities?:{canDownload?:boolean}};
export function matchDriveVideo(code:string,files:DriveVideo[]){
 const matches=files.filter(file=>file.name.replace(/\.[^.]+$/,'').trim().toUpperCase()===code.toUpperCase());
 if(matches.length>1)throw Error('DRIVE_VIDEO_DUPLICATE');
 const file=matches[0];if(!file)return null;
 if(file.mimeType!=='video/mp4'||!file.name.toLowerCase().endsWith('.mp4'))throw Error('DRIVE_VIDEO_FORMAT');
 const size=Number(file.size);if(!Number.isSafeInteger(size)||size<=0||size>maxDriveVideoBytes)throw Error('DRIVE_VIDEO_SIZE');
 if(file.capabilities?.canDownload===false)throw Error('DRIVE_DOWNLOAD_DENIED');
 return file;
}
export const driveVideoFingerprint=(file:DriveVideo)=>createHash('sha256').update([file.id,file.modifiedTime??'',file.md5Checksum??'',file.size].join('|')).digest('hex');
const quoted=(value:string)=>value.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
export async function findDriveVideo(code:string):Promise<DriveVideo|null>{
 if(!await db.driveConnection.findFirst({where:{id:'active',encryptedToken:{not:null}},select:{id:true}}))return null;
 const access=await driveAccess(),files:DriveVideo[]=[];let pageToken='';
 do{
  const q="trashed = false and mimeType contains 'video/' and name contains '"+quoted(code)+"'"+(access.folderId?" and '"+quoted(access.folderId)+"' in parents":'');
  const params=new URLSearchParams({q,fields:'nextPageToken,files(id,name,mimeType,size,modifiedTime,md5Checksum,capabilities(canDownload))',pageSize:'100',spaces:'drive',supportsAllDrives:'true',includeItemsFromAllDrives:'true',...(pageToken?{pageToken}:{})});
  const response=await fetch('https://www.googleapis.com/drive/v3/files?'+params,{headers:{Authorization:'Bearer '+access.token},cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(response.status===401?'DRIVE_RECONNECT':'DRIVE_SEARCH_FAILED');
  const result=await response.json();files.push(...(result.files??[]));pageToken=result.nextPageToken??'';
  if(files.length>=500&&pageToken)throw Error('DRIVE_SEARCH_TOO_LARGE');
 }while(pageToken);
 return matchDriveVideo(code,files);
}
export async function downloadDriveVideo(file:DriveVideo){
 const access=await driveAccess();
 const response=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(file.id)+'?alt=media&supportsAllDrives=true',{headers:{Authorization:'Bearer '+access.token},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(120000)});
 if(!response.ok||!response.body)throw Error('DRIVE_DOWNLOAD_FAILED');
 const folder=await mkdtemp(join(tmpdir(),'cannexa-video-')),path=join(folder,'video.mp4');
 const release=()=>rm(folder,{recursive:true,force:true});let handle;
 try{
  handle=await open(path,'wx');let size=0;const digest=createHash('md5'),reader=response.body.getReader();
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxDriveVideoBytes){await reader.cancel();throw Error('DRIVE_VIDEO_SIZE');}digest.update(value);await handle.writeFile(value);}}finally{reader.releaseLock();}
  await handle.close();handle=undefined;
  if(size!==Number(file.size)||(file.md5Checksum&&digest.digest('hex')!==file.md5Checksum))throw Error('DRIVE_VIDEO_CHANGED');
  return {path,release};
 }catch(error){await handle?.close().catch(()=>{});await release();throw error;}
}
