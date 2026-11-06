ALTER TABLE "Customer" ADD COLUMN "lineUserKey" TEXT;
CREATE UNIQUE INDEX "Customer_lineUserKey_key" ON "Customer"("lineUserKey");
CREATE TABLE "CustomerCodeDelivery" (
 "userKey" TEXT PRIMARY KEY,
 "customerCode" TEXT NOT NULL,
 "eventId" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'SENDING',
 "lastError" TEXT,
 "sentAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CustomerCodeDelivery_eventId_key" ON "CustomerCodeDelivery"("eventId");
