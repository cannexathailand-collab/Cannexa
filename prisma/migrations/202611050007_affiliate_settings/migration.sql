ALTER TABLE "Affiliate"
 ADD COLUMN "archivedAt" TIMESTAMP(3),
 ADD COLUMN "salesCommissionBasis" TEXT NOT NULL DEFAULT 'REVENUE',
 ADD COLUMN "salesCommissionBps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Affiliate"
 ADD CONSTRAINT "Affiliate_salesCommissionBasis_check" CHECK ("salesCommissionBasis" IN ('REVENUE', 'PROFIT')),
 ADD CONSTRAINT "Affiliate_salesCommissionBps_check" CHECK ("salesCommissionBps" BETWEEN 0 AND 10000);
