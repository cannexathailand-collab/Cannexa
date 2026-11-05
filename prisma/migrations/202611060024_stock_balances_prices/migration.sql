ALTER TABLE "StockProduct" ADD COLUMN "issuedQuantity" DECIMAL(18,3), ADD COLUMN "remainingQuantity" DECIMAL(18,3), ADD COLUMN "salePrices" JSONB NOT NULL DEFAULT '[]';
