import {db} from "./db";
import {commissionPeriod} from "./commission-month";

export async function commissionReport(requestedMonth?: string) {
 const [affiliates, rows] = await Promise.all([db.affiliate.findMany({
  orderBy: {name: "asc"},
  include: {accounts: {where: {role: "employee"}, select: {username: true}, orderBy: {username: "asc"}}},
 }), db.commission.findMany({
  where: { OR: [
   {status: "Approved", conversion: {status: "VERIFIED_NEW_FRIEND"}},
   {status: "Paid"},
  ] },
  orderBy: [{conversion: {verifiedAt: {sort: "desc", nulls: "last"}}}, {conversion: {createdAt: "desc"}}],
  include: {conversion: {select: {affiliateId: true, verifiedAt: true, createdAt: true}}},
 })]);
 const {month, months, entries} = commissionPeriod(rows, requestedMonth);
 const groups = Map.groupBy(entries, row => row.conversion.affiliateId);
 return {affiliates, groups, month, months};
}
