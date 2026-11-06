CREATE TABLE "StockReturn" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "tracking" TEXT NOT NULL,
 "orderId" TEXT,
 "stage" TEXT NOT NULL DEFAULT 'IN_TRANSIT',
 "status" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
 "reportedAt" TIMESTAMP(3) NOT NULL,
 "receivedAt" TIMESTAMP(3),
 "evidence" JSONB NOT NULL DEFAULT '[]',
 "items" JSONB NOT NULL DEFAULT '[]',
 "sourceSheet" TEXT,
 "totalCostSatang" INTEGER,
 "historySnapshot" JSONB,
 "historySavedAt" TIMESTAMP(3),
 "processedAt" TIMESTAMP(3),
 "issues" JSONB NOT NULL DEFAULT '[]',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "StockReturn_tracking_key" ON "StockReturn"("tracking");
CREATE UNIQUE INDEX "StockReturn_orderId_key" ON "StockReturn"("orderId");
CREATE INDEX "StockReturn_stage_status_reportedAt_idx" ON "StockReturn"("stage","status","reportedAt");

CREATE TABLE "StockReturnReport" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "messageId" TEXT NOT NULL,
 "tracking" TEXT NOT NULL,
 "sender" TEXT NOT NULL,
 "subject" TEXT NOT NULL,
 "reportedAt" TIMESTAMP(3) NOT NULL,
 "stage" TEXT NOT NULL,
 "reason" TEXT NOT NULL,
 "receivedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "StockReturnReport_messageId_tracking_key" ON "StockReturnReport"("messageId","tracking");
CREATE INDEX "StockReturnReport_tracking_idx" ON "StockReturnReport"("tracking");
