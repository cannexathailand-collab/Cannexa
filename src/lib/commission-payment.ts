import {transaction} from "./db";

export async function markAffiliatePaid(ids: string[], actor: string) {
 if (!ids.length) {
  throw new Error("ไม่มีรายการค้างจ่าย");
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
   details: {commissionIds, amountSatang: pending.reduce((sum, row) => sum + row.amountSatang, 0)},
  }});
 });
}
