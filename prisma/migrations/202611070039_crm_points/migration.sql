CREATE TABLE "CrmPointRule" (
 "id" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT false,
 "satangPerPoint" INTEGER NOT NULL,
 "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "createdBy" TEXT NOT NULL,
 CONSTRAINT "CrmPointRule_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CrmPointRule_rate_check" CHECK ("satangPerPoint" > 0)
);
CREATE INDEX "CrmPointRule_effectiveAt_idx" ON "CrmPointRule"("effectiveAt");
