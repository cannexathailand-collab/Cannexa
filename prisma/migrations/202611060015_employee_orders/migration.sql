ALTER TABLE "OrderIntake" ADD COLUMN "sellerUsername" TEXT;
UPDATE "OrderIntake" o SET "sellerUsername" = u."username"
FROM "UserAccount" u WHERE u."role" = 'employee' AND u."affiliateId" = o."affiliateId" AND lower(u."username") = lower(o."sellerCode");
UPDATE "OrderIntake" o SET "sellerUsername" = u."username"
FROM "UserAccount" u, "Affiliate" a WHERE o."sellerUsername" IS NULL AND u."role" = 'employee' AND u."active" = true
AND u."affiliateId" = o."affiliateId" AND a."id" = o."affiliateId" AND lower(a."code") = lower(o."sellerCode")
AND (SELECT count(*) FROM "UserAccount" x WHERE x."affiliateId" = o."affiliateId" AND x."role" = 'employee' AND x."active" = true) = 1;
CREATE INDEX "OrderIntake_sellerUsername_createdAt_idx" ON "OrderIntake"("sellerUsername", "createdAt");
