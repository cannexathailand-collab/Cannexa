CREATE TABLE "StockSheetsConnection" (
 "id" TEXT NOT NULL,
 "encryptedConfig" TEXT NOT NULL,
 "email" TEXT NOT NULL,
 "revision" TEXT NOT NULL,
 "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "StockSheetsConnection_pkey" PRIMARY KEY ("id")
);
