ALTER TABLE "StockSheetsConnection" ADD COLUMN "systemPrimary" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "StockWorkbook" (
    "id" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "dirty" BOOLEAN NOT NULL DEFAULT true,
    "syncLeaseUntil" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "syncError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StockWorkbook_pkey" PRIMARY KEY ("id")
);
