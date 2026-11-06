CREATE TABLE "StockHistoryConfig" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "enabled" BOOLEAN NOT NULL DEFAULT true,
 "startDay" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "StockDailySnapshot" (
 "day" TEXT NOT NULL PRIMARY KEY,
 "actor" TEXT NOT NULL,
 "sourceSheet" TEXT NOT NULL,
 "capturedAt" TIMESTAMP(3) NOT NULL,
 "products" JSONB NOT NULL,
 "rows" JSONB NOT NULL,
 "fingerprint" TEXT NOT NULL,
 "sheetId" INTEGER NOT NULL,
 "sheetTitle" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "exportedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "StockDailySnapshot_sheetId_key" ON "StockDailySnapshot"("sheetId");
CREATE UNIQUE INDEX "StockDailySnapshot_sheetTitle_key" ON "StockDailySnapshot"("sheetTitle");
INSERT INTO "StockHistoryConfig" ("id","startDay") VALUES ('active',to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok','YYYY-MM-DD'));
