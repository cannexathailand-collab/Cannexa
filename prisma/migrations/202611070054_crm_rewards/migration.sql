CREATE TABLE "CrmReward" (
 "id" TEXT NOT NULL,
 "requestKey" TEXT NOT NULL,
 "requestFingerprint" TEXT NOT NULL,
 "name" TEXT NOT NULL,
 "description" TEXT NOT NULL DEFAULT '',
 "points" INTEGER NOT NULL,
 "availableUnits" INTEGER NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CrmReward_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CrmReward_values_check" CHECK ("points" > 0 AND "availableUnits" >= 0)
);
CREATE UNIQUE INDEX "CrmReward_requestKey_key" ON "CrmReward"("requestKey");
CREATE INDEX "CrmReward_enabled_createdAt_idx" ON "CrmReward"("enabled","createdAt");

CREATE TABLE "CrmRewardRedemption" (
 "id" TEXT NOT NULL,
 "requestKey" TEXT NOT NULL,
 "customerCode" TEXT NOT NULL,
 "rewardId" TEXT NOT NULL,
 "rewardName" TEXT NOT NULL,
 "points" INTEGER NOT NULL,
 "recipient" TEXT NOT NULL,
 "phone" TEXT NOT NULL,
 "address" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "resolvedAt" TIMESTAMP(3),
 "resolvedBy" TEXT,
 CONSTRAINT "CrmRewardRedemption_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CrmRewardRedemption_values_check" CHECK ("points" > 0 AND "status" IN ('PENDING','FULFILLED','REJECTED')),
 CONSTRAINT "CrmRewardRedemption_customerCode_fkey" FOREIGN KEY ("customerCode") REFERENCES "Customer"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "CrmRewardRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "CrmReward"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CrmRewardRedemption_customerCode_requestKey_key" ON "CrmRewardRedemption"("customerCode","requestKey");
CREATE INDEX "CrmRewardRedemption_customerCode_status_idx" ON "CrmRewardRedemption"("customerCode","status");
CREATE INDEX "CrmRewardRedemption_status_createdAt_idx" ON "CrmRewardRedemption"("status","createdAt");
