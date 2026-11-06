CREATE TABLE "AdditionalCommission" (
 "id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL, "affiliateId" TEXT NOT NULL,
 "basis" TEXT NOT NULL, "bps" INTEGER NOT NULL CHECK ("bps" BETWEEN 0 AND 10000),
 "amountSatang" INTEGER, "status" TEXT NOT NULL DEFAULT 'WAITING_SALE',
 "paidAt" TIMESTAMP(3), "paidAmountSatang" INTEGER, "reversedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AdditionalCommission_orderId_affiliateId_key" ON "AdditionalCommission"("orderId","affiliateId");
CREATE INDEX "AdditionalCommission_affiliateId_status_idx" ON "AdditionalCommission"("affiliateId","status");
