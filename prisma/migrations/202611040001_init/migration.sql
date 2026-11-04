-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TrackingStatus" AS ENUM ('CLICKED', 'LOGIN_SUCCESS', 'VERIFIED_FRIEND', 'VERIFIED_NEW_FRIEND', 'EXISTING_FRIEND', 'UNBLOCKED', 'NOT_FRIEND', 'PENDING_REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('Pending', 'Approved', 'Paid', 'Rejected');

-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "rateSatang" INTEGER NOT NULL DEFAULT 500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingLink" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,

    CONSTRAINT "TrackingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Click" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userKey" TEXT,
    "loginAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'LINE',
    "loginResult" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "status" "TrackingStatus" NOT NULL DEFAULT 'CLICKED',

    CONSTRAINT "Click_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAttempt" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "browserHash" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "clickId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversion" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'LINE',
    "userKey" TEXT NOT NULL,
    "clickId" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "friendFlag" BOOLEAN,
    "friendshipChanged" BOOLEAN,
    "status" "TrackingStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reason" TEXT NOT NULL,
    "rateSatang" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "Conversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" TEXT NOT NULL,
    "conversionId" TEXT NOT NULL,
    "status" "TrackingStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "userKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isUnblocked" BOOLEAN,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "conversionId" TEXT NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'Pending',
    "amountSatang" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_code_key" ON "Affiliate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingLink_affiliateId_key" ON "TrackingLink"("affiliateId");

-- CreateIndex
CREATE INDEX "Click_createdAt_affiliateId_idx" ON "Click"("createdAt", "affiliateId");

-- CreateIndex
CREATE INDEX "Click_userKey_idx" ON "Click"("userKey");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAttempt_stateHash_key" ON "OAuthAttempt"("stateHash");

-- CreateIndex
CREATE UNIQUE INDEX "Conversion_userKey_key" ON "Conversion"("userKey");

-- CreateIndex
CREATE UNIQUE INDEX "Conversion_clickId_key" ON "Conversion"("clickId");

-- CreateIndex
CREATE INDEX "WebhookEvent_userKey_eventAt_idx" ON "WebhookEvent"("userKey", "eventAt");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_conversionId_key" ON "Commission"("conversionId");

-- AddForeignKey
ALTER TABLE "TrackingLink" ADD CONSTRAINT "TrackingLink_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "TrackingLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAttempt" ADD CONSTRAINT "OAuthAttempt_clickId_fkey" FOREIGN KEY ("clickId") REFERENCES "Click"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_clickId_fkey" FOREIGN KEY ("clickId") REFERENCES "Click"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "Conversion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "Conversion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
