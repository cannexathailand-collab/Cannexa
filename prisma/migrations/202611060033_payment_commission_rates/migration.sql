ALTER TABLE "Affiliate" ADD COLUMN "salesCommissionTransferBps" INTEGER,
ADD COLUMN "salesCommissionCodBps" INTEGER;
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_transfer_commission_range" CHECK ("salesCommissionTransferBps" BETWEEN 0 AND 10000),
ADD CONSTRAINT "Affiliate_cod_commission_range" CHECK ("salesCommissionCodBps" BETWEEN 0 AND 10000);
