CREATE TABLE "WebsiteOrder" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "orderNumber" TEXT NOT NULL,
 "customerCode" TEXT NOT NULL,
 "requestKey" TEXT NOT NULL,
 "requestFingerprint" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
 "items" JSONB NOT NULL,
 "totalSatang" INTEGER NOT NULL,
 "recipient" TEXT NOT NULL,
 "phone" TEXT NOT NULL,
 "address" TEXT NOT NULL,
 "reviewNote" TEXT NOT NULL DEFAULT '',
 "reviewedBy" TEXT,
 "reviewedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "WebsiteOrder_customerCode_fkey" FOREIGN KEY ("customerCode") REFERENCES "Customer"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "WebsiteOrder_status_check" CHECK ("status" IN ('PENDING_REVIEW','APPROVED','REJECTED')),
 CONSTRAINT "WebsiteOrder_total_check" CHECK ("totalSatang" > 0),
 CONSTRAINT "WebsiteOrder_items_check" CHECK (jsonb_typeof("items") = 'array')
);
CREATE UNIQUE INDEX "WebsiteOrder_orderNumber_key" ON "WebsiteOrder"("orderNumber");
CREATE UNIQUE INDEX "WebsiteOrder_customerCode_requestKey_key" ON "WebsiteOrder"("customerCode", "requestKey");
CREATE INDEX "WebsiteOrder_status_createdAt_idx" ON "WebsiteOrder"("status", "createdAt");
CREATE INDEX "WebsiteOrder_customerCode_createdAt_idx" ON "WebsiteOrder"("customerCode", "createdAt");
