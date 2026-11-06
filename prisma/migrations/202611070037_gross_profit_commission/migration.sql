ALTER TABLE "Affiliate" DROP CONSTRAINT "Affiliate_salesCommissionBasis_check",
 ADD CONSTRAINT "Affiliate_salesCommissionBasis_check"
 CHECK ("salesCommissionBasis" IN ('REVENUE', 'PROFIT', 'GROSS_PROFIT'));
