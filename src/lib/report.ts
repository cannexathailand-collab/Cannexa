import {employeeRoles} from './accounts';
import {metaAdCode} from "@/lib/meta-ad";
import {db} from "./db";
import {mockMode} from "./config";
export function since(period:string){const days=period==="day"?1:period==="week"?7:period==="month"?30:0;return days?new Date(Date.now()-days*86400000):new Date(0);}
export async function report(period:string,affiliateId?:string, includeEmployees=false){
 const from=since(period);const source=mockMode()?"MOCK":"LINE";
 const affiliates=await db.affiliate.findMany({where:{id:affiliateId,code:{not:metaAdCode}},orderBy:{createdAt:"asc"},include:{accounts:includeEmployees?{where:{role:{in:employeeRoles}},select:{username:true},orderBy:{username:"asc"}}:false,clicks:{where:{source,createdAt:{gte:from}}},conversions:{where:{source,createdAt:{gte:from}},include:{commission:true}}}});
 return affiliates.map(a=>{
 const newFriends=a.conversions.filter(c=>c.status==="VERIFIED_NEW_FRIEND");
 return {id:a.id,code:a.code,name:a.name,active:a.active,clicks:a.clicks.length,logins:a.clicks.filter(c=>c.loginAt).length,friends:a.conversions.filter(c=>c.friendFlag===true).length,approved:newFriends.length,employeeAccounts:a.accounts??[],pending:a.conversions.filter(c=>c.status==="PENDING_REVIEW").length,rejected:a.conversions.filter(c=>["REJECTED","EXISTING_FRIEND","UNBLOCKED","NOT_FRIEND"].includes(c.status)).length,paidSatang:a.conversions.reduce((n,c)=>n+(c.commission?.status==="Paid"?c.commission.amountSatang:0),0),commissionSatang:a.conversions.reduce((n,c)=>n+(c.commission&&["Approved","Paid"].includes(c.commission.status)?c.commission.amountSatang:0),0)};});
}
