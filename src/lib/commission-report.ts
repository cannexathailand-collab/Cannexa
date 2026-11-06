import {metaAdCode} from "@/lib/meta-ad";
import {db} from "./db";
import {commissionPeriod} from "./commission-month";
import {mockMode} from "./config";

export type CommissionEntry={id:string;kind:"FRIEND"|"SALE"|"SPECIAL";status:"Approved"|"Paid";amountSatang:number;description?:string;conversion:{affiliateId:string;verifiedAt:Date|null;createdAt:Date}};

export async function commissionReport(requestedMonth?: string,affiliateId?:string) {
 const [affiliates, friends, sales, extras, specials] = await Promise.all([db.affiliate.findMany({
  where: {id:affiliateId,code: {not: metaAdCode}},
  orderBy: {name: "asc"},
  include: {accounts: {where: {role: "employee"}, select: {username: true}, orderBy: {username: "asc"}}},
 }), db.commission.findMany({
  where: {conversion:{affiliateId,source:mockMode()?"MOCK":"LINE"}, OR: [
   {status: "Approved", conversion: {status: "VERIFIED_NEW_FRIEND"}},
   {status: "Paid"},
  ] },
  orderBy: [{conversion: {verifiedAt: {sort: "desc", nulls: "last"}}}, {conversion: {createdAt: "desc"}}],
  include: {conversion: {select: {affiliateId: true, verifiedAt: true, createdAt: true}}},
 }),db.salesOrder.findMany({where:{affiliateId,OR:[{status:"PENDING",commissionSatang:{not:null}},{status:"PAID"}]},orderBy:{createdAt:"desc"}}),db.additionalCommission.findMany({where:{affiliateId,OR:[{status:'PENDING',amountSatang:{not:null}},{status:'PAID'}]},orderBy:{createdAt:'desc'}}),db.specialCommission.findMany({where:{affiliateId},orderBy:{paidAt:'desc'}})]);
 const rows:CommissionEntry[]=[
  ...friends.map(row=>({id:"friend:"+row.id,kind:"FRIEND" as const,status:row.status as "Approved"|"Paid",amountSatang:row.amountSatang,conversion:row.conversion})),
  ...sales.map(row=>({id:"sale:"+row.id,kind:"SALE" as const,status:row.status==="PENDING"?"Approved" as const:"Paid" as const,amountSatang:row.status==="PENDING"?row.commissionSatang!:(row.paidAmountSatang??row.commissionSatang??0),conversion:{affiliateId:row.affiliateId,verifiedAt:null,createdAt:row.createdAt}})),
  ...extras.map(row=>({id:'extra:'+row.id,kind:'SALE' as const,status:row.status==='PENDING'?'Approved' as const:'Paid' as const,amountSatang:row.status==='PENDING'?row.amountSatang!:(row.paidAmountSatang??row.amountSatang??0),conversion:{affiliateId:row.affiliateId,verifiedAt:null,createdAt:row.createdAt}})),
  ...specials.map(row=>({id:'special:'+row.id,kind:'SPECIAL' as const,status:'Paid' as const,amountSatang:row.amountSatang,description:row.reason,conversion:{affiliateId:row.affiliateId,verifiedAt:row.paidAt,createdAt:row.createdAt}})),
 ];
 const {month, months, entries} = commissionPeriod(rows, requestedMonth);
 const groups = Map.groupBy(entries, row => row.conversion.affiliateId);
 return {affiliates, groups, month, months};
}
