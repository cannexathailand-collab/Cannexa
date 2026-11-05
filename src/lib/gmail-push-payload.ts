import {z} from "zod";
const history=z.union([z.string().regex(/^\d+$/),z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)]).transform(String);
const notification=z.object({emailAddress:z.email(),historyId:history});
export function decodeGmailPush(raw:string){
 const body=JSON.parse(raw);
 // Pub/Sub can deliver wrapped data or the original body with payload unwrapping.
 if(body?.message&&typeof body.message.data==="string"){
  if(body.message.data.length>50000)throw new Error("INVALID_NOTIFICATION");
  return notification.parse(JSON.parse(Buffer.from(body.message.data,"base64url").toString("utf8")));
 }
 return notification.parse(body);
}
