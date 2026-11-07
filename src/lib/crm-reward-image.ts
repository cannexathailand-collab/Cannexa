import {createHash} from 'node:crypto';

export const maxRewardImageBytes=2*1024*1024;

export function parseRewardImage(value:string){
 const maxEncodedLength=Math.ceil(maxRewardImageBytes/3)*4;
 if(value.length>maxEncodedLength+64)throw Error('REWARD_IMAGE_TOO_LARGE');
 const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
 if(!match||match[2].length%4!==0)throw Error('INVALID_REWARD_IMAGE');
 const data=Buffer.from(match[2],'base64');
 if(data.length>maxRewardImageBytes)throw Error('REWARD_IMAGE_TOO_LARGE');
 if(!data.length||data.toString('base64')!==match[2])throw Error('INVALID_REWARD_IMAGE');
 const imageMime=match[1];
 const png=data.length>=8&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpeg=data.length>=3&&data[0]===255&&data[1]===216&&data[2]===255;
 const webp=data.length>=12&&data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP';
 if(!(imageMime==='image/png'&&png||imageMime==='image/jpeg'&&jpeg||imageMime==='image/webp'&&webp))throw Error('INVALID_REWARD_IMAGE');
 return {imageData:new Uint8Array(data),imageMime,imageVersion:createHash('sha256').update(data).digest('hex')};
}
