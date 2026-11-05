ALTER TABLE "OrderGroup" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'ORDER';
ALTER TABLE "Commission" ADD COLUMN "paidAt" TIMESTAMP(3);
CREATE TABLE "Expense" (
 "id" TEXT NOT NULL, "messageKey" TEXT NOT NULL, "eventKey" TEXT NOT NULL, "groupKey" TEXT NOT NULL, "expenseNumber" TEXT NOT NULL,
 "description" TEXT, "amountSatang" INTEGER, "bankName" TEXT, "bankAccount" TEXT, "recipient" TEXT, "rawText" TEXT,
 "status" TEXT NOT NULL, "issues" JSONB NOT NULL, "eventAt" TIMESTAMP(3) NOT NULL, "paidAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Expense_messageKey_key" ON "Expense"("messageKey");
CREATE UNIQUE INDEX "Expense_eventKey_key" ON "Expense"("eventKey");
CREATE UNIQUE INDEX "Expense_expenseNumber_key" ON "Expense"("expenseNumber");
CREATE INDEX "Expense_paidAt_status_idx" ON "Expense"("paidAt","status");
CREATE INDEX "Expense_groupKey_eventAt_idx" ON "Expense"("groupKey","eventAt");
UPDATE "Commission" c SET "paidAt" = (
 SELECT MIN(a."createdAt") FROM "AuditLog" a
 WHERE (a."action" = 'COMMISSION_PAID_BATCH' AND (a."details"->'commissionIds') ? c."id")
    OR (a."action" = 'COMMISSION_PAID' AND a."entityId" = c."conversionId")
) WHERE c."status" = 'Paid' AND c."paidAt" IS NULL;
CREATE INDEX "Commission_status_paidAt_idx" ON "Commission"("status","paidAt");
