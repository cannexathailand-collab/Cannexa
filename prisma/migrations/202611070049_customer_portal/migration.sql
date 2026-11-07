ALTER TABLE "OAuthAttempt" ALTER COLUMN "clickId" DROP NOT NULL;
ALTER TABLE "OAuthAttempt" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'AFFILIATE', ADD COLUMN "customerLinkHash" TEXT;
CREATE TABLE "CustomerAccessLink" (
 "tokenHash" TEXT NOT NULL PRIMARY KEY,
 "customerCode" TEXT NOT NULL,
 "createdBy" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "usedAt" TIMESTAMP(3),
 CONSTRAINT "CustomerAccessLink_customerCode_fkey" FOREIGN KEY ("customerCode") REFERENCES "Customer"("code") ON DELETE CASCADE ON UPDATE CASCADE
);
