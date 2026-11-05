CREATE TABLE "OrderGroup" (
 "id" TEXT PRIMARY KEY, "botId" TEXT NOT NULL, "groupId" TEXT NOT NULL,
 "name" TEXT NOT NULL DEFAULT '', "enabled" BOOLEAN NOT NULL DEFAULT false,
 "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "OrderGroup_botId_groupId_key" ON "OrderGroup"("botId", "groupId");
CREATE TABLE "OrderIntake" (
 "id" TEXT PRIMARY KEY, "eventKey" TEXT NOT NULL, "messageKey" TEXT NOT NULL,
 "groupKey" TEXT NOT NULL, "senderKey" TEXT, "orderNumber" TEXT NOT NULL,
 "rawText" TEXT, "sellerCode" TEXT, "affiliateId" TEXT, "recipient" TEXT,
 "phone" TEXT, "address" TEXT, "payment" TEXT,
 "status" TEXT NOT NULL DEFAULT 'WAITING_SHIPMENT', "issues" JSONB NOT NULL,
 "eventAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "withdrawnAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "OrderIntake_eventKey_key" ON "OrderIntake"("eventKey");
CREATE UNIQUE INDEX "OrderIntake_messageKey_key" ON "OrderIntake"("messageKey");
CREATE UNIQUE INDEX "OrderIntake_orderNumber_key" ON "OrderIntake"("orderNumber");
CREATE INDEX "OrderIntake_groupKey_createdAt_idx" ON "OrderIntake"("groupKey", "createdAt");
CREATE TABLE "OrderMessageWithdrawal" ("messageKey" TEXT PRIMARY KEY, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "OrderBot" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "botId" TEXT NOT NULL, "encrypted" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "OrderBot_botId_key" ON "OrderBot"("botId");
