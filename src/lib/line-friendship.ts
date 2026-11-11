import {db} from './db';

export async function verifiedLineFriendship(key:string,apiStatus:boolean|null){
 if(apiStatus!==null)return apiStatus;
 const [event,recipient]=await Promise.all([
  db.webhookEvent.findFirst({where:{userKey:key,type:{in:['follow','unfollow']}},orderBy:[{eventAt:'desc'},{receivedAt:'desc'}],select:{type:true,eventAt:true}}),
  db.lineMessageRecipient.findUnique({where:{lineUserKey:key},select:{friendFlag:true,friendshipAt:true}}),
 ]);
 if(recipient?.friendFlag!==null&&recipient?.friendshipAt&&(!event||recipient.friendshipAt>event.eventAt))return recipient.friendFlag;
 return event?event.type==='follow':null;
}
