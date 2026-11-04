import {transaction} from "./db";

export async function markAffiliatePaid(ids: string[], reason: string, actor: string) {
 if (!ids.length || reason.trim().length < 20 || reason.length > 3000) {
  throw new Error("กรุณาระบุอ้างอิงการจ่ายอย่างน้อย 20 ตัวอักษร");
 }
 const uniqueIds = [...new Set(ids)];
 await transaction(async tx => {
  const rows = await tx.commission.findMany({
   where: {id: {in: uniqueIds}},
   include: {conversion: true},
  });
  if (rows.length !== uniqueIds.length) throw new Error("กรุณาเปิดหน้าค่าคอมใหม่");
  const first = rows[0].conversion;
   if (rows.some(({status, conversion}) =>
   conversion.affiliateId !== first.affiliateId ||
   (conversion.source === "MOCK" && process.env.NODE_ENV === "production") ||
   (status !== "Paid" && (status !== "Approved" || conversion.status !== "VERIFIED_NEW_FRIEND"))
  )) throw new Error("รายการเปลี่ยนแปลง กรุณาเปิดหน้าค่าคอมใหม่");

  const pending = rows.filter(row => row.status === "Approved");
  if (!pending.length) return;
  const commissionIds = pending.map(row => row.id);
  const result = await tx.commission.updateMany({
   where: {id: {in: commissionIds}, status: "Approved"},
   data: {status: "Paid"},
  });
  if (result.count !== pending.length) throw new Error("รายการเปลี่ยนแปลง กรุณาเปิดหน้าค่าคอมใหม่");
  await tx.auditLog.create({data: {
   actor, action: "COMMISSION_PAID_BATCH", entityId: first.affiliateId,
   details: {reason, commissionIds, amountSatang: pending.reduce((sum, row) => sum + row.amountSatang, 0)},
  }});
 });
}
