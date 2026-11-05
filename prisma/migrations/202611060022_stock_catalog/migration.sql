CREATE TABLE "StockProduct" (
 "id" TEXT NOT NULL,
 "code" TEXT NOT NULL,
 "name" TEXT,
 "costSatang" INTEGER,
 "sourceUrl" TEXT NOT NULL,
 "sourceSheet" TEXT NOT NULL,
 "sourceRow" INTEGER NOT NULL,
 "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "StockProduct_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "StockProduct_cost_nonnegative" CHECK ("costSatang" IS NULL OR "costSatang" >= 0)
);
CREATE UNIQUE INDEX "StockProduct_code_key" ON "StockProduct"("code");
