CREATE TABLE "StockIntegrationConfig" ("id" TEXT NOT NULL PRIMARY KEY,"enabled" BOOLEAN NOT NULL DEFAULT false,"activeFrom" TIMESTAMP(3) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "StockDispatch" (
 "id" TEXT NOT NULL PRIMARY KEY,"orderId" TEXT NOT NULL,"orderNumber" TEXT NOT NULL,"candidateTracking" TEXT,"tracking" TEXT,"payment" TEXT,"status" TEXT NOT NULL DEFAULT 'PENDING',"issues" JSONB NOT NULL DEFAULT '[]',"items" JSONB NOT NULL DEFAULT '[]',"totalCostSatang" INTEGER,"sourceSheet" TEXT,"dispatchedAt" TIMESTAMP(3),"processedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "StockDispatch_orderId_key" ON "StockDispatch"("orderId");
CREATE UNIQUE INDEX "StockDispatch_tracking_key" ON "StockDispatch"("tracking");
CREATE INDEX "StockDispatch_status_dispatchedAt_idx" ON "StockDispatch"("status","dispatchedAt");
