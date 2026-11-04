import {db} from "./db";
import {env} from "./config";
export const roles=["admin","manager","viewer","employee"] as const;
export type Role="owner"|typeof roles[number];
export const office:Role[]=["owner","admin","manager","viewer"];
export const managers:Role[]=["owner","admin","manager"];
export const approvers:Role[]=["owner","admin"];
export async function account(username:string){
 const row=await db.userAccount.findUnique({where:{username}});
 if(row)return row;
 if(username==="owner")return {username,role:"owner",active:true,affiliateId:null,salt:env("ADMIN_PASSWORD_SALT"),hash:env("ADMIN_PASSWORD_HASH"),version:"initial"};
 return null;
}
export function home(role:string){return role==="employee"?"/my-performance":"/admin";}
