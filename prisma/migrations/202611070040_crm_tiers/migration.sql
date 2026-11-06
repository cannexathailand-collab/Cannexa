CREATE TABLE "CrmTierSettings" (
 "id" TEXT NOT NULL,
 "vipTopPercent" INTEGER NOT NULL DEFAULT 20,
 "goldTopPercent" INTEGER NOT NULL DEFAULT 40,
 "silverTopPercent" INTEGER NOT NULL DEFAULT 70,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CrmTierSettings_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CrmTierSettings_thresholds_check" CHECK (0 < "vipTopPercent" AND "vipTopPercent" < "goldTopPercent" AND "goldTopPercent" < "silverTopPercent" AND "silverTopPercent" < 100)
);
