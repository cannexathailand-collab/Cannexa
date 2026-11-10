CREATE TABLE "OwnerProfitReport" (
 "id" TEXT PRIMARY KEY,
 "recipientUserId" TEXT,
 "botId" TEXT,
 "enabled" BOOLEAN NOT NULL DEFAULT false,
 "enabledAt" TIMESTAMP(3),
 "bindingHash" TEXT UNIQUE,
 "bindingExpiresAt" TIMESTAMP(3),
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "ProfitReportDelivery" (
 "day" TEXT PRIMARY KEY,
 "recipientUserId" TEXT NOT NULL,
 "botId" TEXT NOT NULL,
 "text" TEXT NOT NULL,
 "retryKey" TEXT NOT NULL UNIQUE,
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "lastAttemptAt" TIMESTAMP(3),
 "leaseUntil" TIMESTAMP(3),
 "sentAt" TIMESTAMP(3),
 "lastError" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
