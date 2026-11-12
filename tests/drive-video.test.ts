import {test} from 'node:test';
import assert from 'node:assert/strict';
import {driveFolderId,driveAuthorization,driveScope} from '../src/lib/drive-connection';
import {matchDriveVideo,driveVideoFingerprint,maxDriveVideoBytes,type DriveVideo} from '../src/lib/drive-video';
const file=(name:string):DriveVideo=>({id:'test-video-id',name,mimeType:'video/mp4',size:'42',modifiedTime:'2026-11-13T00:00:00Z',capabilities:{canDownload:true}});
test('Drive matches an exact SKU and does not silently choose duplicate or unusable videos',()=>{
 assert.equal(matchDriveVideo('AE05',[file('AE050.mp4')]),null);
 assert.equal(matchDriveVideo('AE05',[file('ae05.MP4')])?.id,'test-video-id');
 assert.equal(matchDriveVideo('AE03',[file('AE03')])?.id,'test-video-id');
 assert.throws(()=>matchDriveVideo('AE03',[{...file('AE03'),mimeType:'video/quicktime'}]),/DRIVE_VIDEO_FORMAT/);
 assert.throws(()=>matchDriveVideo('AE03',[file('AE03'),{...file('AE03.mp4'),id:'second'}]),/DRIVE_VIDEO_DUPLICATE/);
 assert.throws(()=>matchDriveVideo('AE05',[file('AE05.mp4'),{...file('AE05.mp4'),id:'second'}]),/DRIVE_VIDEO_DUPLICATE/);
 assert.throws(()=>matchDriveVideo('AE05',[{...file('AE05.mov'),mimeType:'video/quicktime'}]),/DRIVE_VIDEO_FORMAT/);
 assert.throws(()=>matchDriveVideo('AE05',[{...file('AE05.mp4'),size:String(maxDriveVideoBytes+1)}]),/DRIVE_VIDEO_SIZE/);
 assert.throws(()=>matchDriveVideo('AE05',[{...file('AE05.mp4'),capabilities:{canDownload:false}}]),/DRIVE_DOWNLOAD_DENIED/);
 assert.notEqual(driveVideoFingerprint(file('AE05.mp4')),driveVideoFingerprint({...file('AE05.mp4'),modifiedTime:'2026-11-14T00:00:00Z'}));
});
test('Drive folder and OAuth configuration use a fixed callback, read-only scope and PKCE',t=>{
 const previous=process.env.APP_URL;process.env.APP_URL='https://example.com';t.after(()=>{if(previous===undefined)delete process.env.APP_URL;else process.env.APP_URL=previous;});
 assert.equal(driveFolderId(''),null);
 assert.equal(driveFolderId('https://drive.google.com/drive/folders/abcdefghijklmnop?usp=sharing'),'abcdefghijklmnop');
 assert.throws(()=>driveFolderId('https://untrusted.invalid/folder'));
 const url=new URL(driveAuthorization({clientId:'test.apps.googleusercontent.com',clientSecret:'private'},'drive.state','verifier'));
 assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('scope'),driveScope);assert.equal(url.searchParams.get('redirect_uri'),'https://example.com/api/admin/gmail/callback');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(!url.toString().includes('private'));
});

