CREATE TABLE "CrmPointPromotion" (
 "id" TEXT NOT NULL,
 "requestKey" TEXT NOT NULL,
 "name" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT false,
 "startsAt" TIMESTAMP(3) NOT NULL,
 "endsAt" TIMESTAMP(3) NOT NULL,
 "minimumSatang" INTEGER NOT NULL,
 "bonusType" TEXT NOT NULL DEFAULT 'POINTS',
 "bonusValue" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CrmPointPromotion_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CrmPointPromotion_values_check" CHECK ("minimumSatang" > 0 AND "bonusValue" > 0 AND "bonusType" IN ('POINTS','PERCENT') AND "endsAt" > "startsAt")
);
CREATE UNIQUE INDEX "CrmPointPromotion_requestKey_key" ON "CrmPointPromotion"("requestKey");
CREATE INDEX "CrmPointPromotion_enabled_startsAt_endsAt_idx" ON "CrmPointPromotion"("enabled","startsAt","endsAt");
