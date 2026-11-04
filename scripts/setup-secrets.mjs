import {randomBytes,scryptSync} from "node:crypto";
import {readFileSync,writeFileSync,existsSync} from "node:fs";
const target=".env";if(existsSync(target))throw new Error(".env exists; edit manually to avoid overwriting keys");
const password=process.env.SETUP_ADMIN_PASSWORD;if(!password||password.length<16)throw new Error("Set SETUP_ADMIN_PASSWORD with at least 16 characters");
let body=readFileSync(".env.example","utf8");
const salt=randomBytes(32).toString("hex");
for(const [key,value] of Object.entries({SESSION_SECRET:randomBytes(32).toString("hex"),USER_HASH_SECRET:randomBytes(32).toString("hex"),ADMIN_PASSWORD_SALT:salt,ADMIN_PASSWORD_HASH:scryptSync(password,salt,64).toString("hex")})){
 body=body.replace(key+'=""',key+'="'+value+'"');
}
writeFileSync(target,body,{mode:0o600});
console.log(".env created; secrets are not printed. Edit database and LINE credentials.");
