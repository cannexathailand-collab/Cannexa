CREATE TABLE "SpecialCommission" (
 "id" TEXT NOT NULL,
 "requestKey" TEXT NOT NULL,
 "affiliateId" TEXT NOT NULL,
 "amountSatang" INTEGER NOT NULL,
 "reason" TEXT NOT NULL,
 "paidAt" TIMESTAMP(3) NOT NULL,
 "createdBy" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SpecialCommission_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "SpecialCommission_positive_amount" CHECK ("amountSatang" > 0)
);
CREATE UNIQUE INDEX "SpecialCommission_requestKey_key" ON "SpecialCommission"("requestKey");
CREATE INDEX "SpecialCommission_affiliateId_paidAt_idx" ON "SpecialCommission"("affiliateId","paidAt");
