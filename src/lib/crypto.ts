import {createHash,createHmac,randomBytes,timingSafeEqual,scryptSync} from "node:crypto";
import {env} from "./config";
export const random=()=>randomBytes(32).toString("base64url");
export const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
export const userKey=(id:string)=>createHmac("sha256",env("USER_HASH_SECRET")).update(id).digest("hex");
export function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function validSignature(raw:string,signature:string,secret:string){return equal(createHmac("sha256",secret).update(raw).digest("base64"),signature);}
export function challenge(v:string){return createHash("sha256").update(v).digest("base64url");}
export function signToken(data:object){const body=Buffer.from(JSON.stringify(data)).toString("base64url");return body+"."+createHmac("sha256",env("SESSION_SECRET")).update(body).digest("base64url");}
export function readToken<T>(token:string):T|null{try{const [body,sig,...extra]=token.split(".");if(extra.length||!sig||!equal(sig,createHmac("sha256",env("SESSION_SECRET")).update(body).digest("base64url")))return null;return JSON.parse(Buffer.from(body,"base64url").toString()) as T;}catch{return null;}}

export function passwordHash(password:string,salt:string){return scryptSync(password,salt,64).toString("hex");}
