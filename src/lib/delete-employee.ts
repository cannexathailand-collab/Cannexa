import {transaction} from "./db";
import {isEmployeeRole} from "./accounts";

export async function deleteEmployee(username: string, actor: string) {
 if (!/^[a-z0-9._-]{3,64}$/.test(username) || username === "owner" || username === actor) {
  throw new Error("Invalid employee");
 }
 await transaction(async tx => {
  const account = await tx.userAccount.findUnique({where: {username}, select: {role: true}});
  if (!account || !isEmployeeRole(account.role)&&account.role!=='store') return;
  const deleted = await tx.userAccount.deleteMany({where: {username, role: account.role}});
  if (!deleted.count) return;
  await tx.auditLog.create({data: {
   actor, action: "USER_DELETED", entityId: username, details: {role: account.role},
  }});
 });
}
