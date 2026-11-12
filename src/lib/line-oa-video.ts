import type {Page} from 'playwright-core';
import {db} from './db';
import {findDriveVideo,downloadDriveVideo,driveVideoFingerprint,type DriveVideo} from './drive-video';

const messageBlocks=(page:Page)=>page.locator('main div.card.border-secondary');
const videoBlocks=(page:Page)=>messageBlocks(page).filter({has:page.locator('button[aria-label="วิดีโอ"].active')});
export async function syncReplyVideo(page:Page,account:string,code:string){
 console.info('OA video stage: FIND');
 const file=await findDriveVideo(code);if(!file)return null;
 let stage='LAYOUT';
 try{
 let video=videoBlocks(page);
 if(await video.count()>1)throw Error('OA_VIDEO_LAYOUT_CHANGED');
 const known=await db.lineOaArtifact.findUnique({where:{account_kind_key:{account,kind:'video',key:code}}});
 const unchanged=known?.fingerprint===driveVideoFingerprint(file)&&await video.count()===1&&await video.locator('.card-body .figure img').count()===1;
 if(!unchanged){
  stage='DOWNLOAD';console.info('OA video stage:',stage);
  const download=await downloadDriveVideo(file);
  try{
   if(!await video.count()){
    if(await messageBlocks(page).count()>=5)throw Error('OA_VIDEO_MESSAGE_LIMIT');
    await page.getByRole('button',{name:' เพิ่ม',exact:true}).click();
    await page.getByRole('button',{name:'วิดีโอ',exact:true}).last().click();
   }
   stage='BLOCK';console.info('OA video stage:',stage);
   video=videoBlocks(page);await video.waitFor({state:'visible',timeout:15000});
   stage='CLEAR';console.info('OA video stage:',stage);
   if(await video.locator('.card-body .figure img').count())await video.getByRole('button',{name:'',exact:true}).click();
   stage='DIALOG';console.info('OA video stage:',stage);
   await video.getByRole('link',{name:'อัปโหลดวิดีโอ',exact:true}).click();
   await page.getByRole('heading',{name:'อัปโหลดวิดีโอ',exact:true}).waitFor({state:'visible',timeout:10000});
   stage='PICKER';console.info('OA video stage:',stage);
   const [chooser]=await Promise.all([page.waitForEvent('filechooser',{timeout:15000}),page.getByText('เลือกไฟล์',{exact:true}).click()]);
   stage='UPLOAD';console.info('OA video stage:',stage);
   await chooser.setFiles(download.path);
   await page.getByRole('heading',{name:'อัปโหลดวิดีโอ',exact:true}).waitFor({state:'hidden',timeout:180000});
   await video.locator('.card-body .figure img').waitFor({state:'visible',timeout:180000});
  }finally{await download.release();}
 }
 stage='ORDER';console.info('OA video stage:',stage);
 for(let attempt=0;attempt<5;attempt++){
  const up=videoBlocks(page).getByRole('button',{name:'',exact:true});
  if(!await up.isEnabled())break;await up.click();
 }
 stage='VERIFY';console.info('OA video stage:',stage);await verifyReplyVideo(page);
 return file;
 }catch(error){
  if(error instanceof Error&&/^(DRIVE_|OA_)/.test(error.message))throw error;
  throw Error('OA_VIDEO_'+stage+'_FAILED');
 }
}
export async function verifyReplyVideo(page:Page){
 const first=messageBlocks(page).first();
 await first.locator('button[aria-label="วิดีโอ"].active').waitFor({state:'visible',timeout:20000});
 await first.locator('.card-body .figure img').waitFor({state:'visible',timeout:20000});
 if(await videoBlocks(page).count()!==1)throw Error('OA_VIDEO_VERIFY_FAILED');
}
export async function recordReplyVideo(account:string,code:string,file:DriveVideo){
 await db.lineOaArtifact.upsert({where:{account_kind_key:{account,kind:'video',key:code}},create:{account,kind:'video',key:code,remoteId:file.id,fingerprint:driveVideoFingerprint(file)},update:{remoteId:file.id,fingerprint:driveVideoFingerprint(file)}});
}
