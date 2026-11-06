CREATE TABLE "CrmMembershipReview" (
 "id" TEXT NOT NULL,
 "customerCode" TEXT NOT NULL,
 "month" TEXT NOT NULL,
 "assessedMonth" TEXT NOT NULL,
 "level" TEXT NOT NULL,
 "failedMonths" INTEGER NOT NULL DEFAULT 0,
 "decision" TEXT NOT NULL,
 "metrics" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CrmMembershipReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CrmMembershipReview_customerCode_month_key" ON "CrmMembershipReview"("customerCode","month");
CREATE INDEX "CrmMembershipReview_month_idx" ON "CrmMembershipReview"("month");
