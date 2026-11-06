CREATE TABLE "Customer" (
 "code" TEXT PRIMARY KEY DEFAULT customer_code(),
 "conversionId" TEXT UNIQUE REFERENCES "Conversion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "identityKey" TEXT UNIQUE, "name" TEXT, "phone" TEXT,
 "referrerId" TEXT REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "metaFbc" TEXT, "legacy" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "Customer" ("code","conversionId","referrerId","metaFbc","legacy","createdAt")
 SELECT c."customerCode",c.id,c."affiliateId",k."metaFbc",true,c."createdAt" FROM "Conversion" c JOIN "Click" k ON k.id=c."clickId";
ALTER TABLE "OrderIntake" DROP CONSTRAINT "OrderIntake_customerCode_fkey";
ALTER TABLE "OrderIntake" ADD CONSTRAINT "OrderIntake_customerCode_fkey" FOREIGN KEY ("customerCode") REFERENCES "Customer"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderIntake" ADD COLUMN "commissionAffiliateId" TEXT;
UPDATE "OrderIntake" SET "commissionAffiliateId"="affiliateId";
CREATE TABLE "MetaPurchase" (
 "orderId" TEXT PRIMARY KEY, "eventId" TEXT NOT NULL UNIQUE, "payload" JSONB NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
 "lastError" TEXT, "sentAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
