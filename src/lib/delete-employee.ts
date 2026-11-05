import {transaction} from "./db";

export async function deleteEmployee(username: string, actor: string) {
 if (!/^[a-z0-9._-]{3,64}$/.test(username) || username === "owner" || username === actor) {
  throw new Error("Invalid employee");
 }
 await transaction(async tx => {
  const deleted = await tx.userAccount.deleteMany({where: {username, role: "employee"}});
  if (!deleted.count) return;
  await tx.auditLog.create({data: {
   actor, action: "USER_DELETED", entityId: username, details: {role: "employee"},
  }});
 });
}
