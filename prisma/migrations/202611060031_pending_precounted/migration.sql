ALTER TABLE "StockReservation" ADD COLUMN "precounted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StockReservation" ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StockReservation" ADD COLUMN "needsReconciliation" BOOLEAN NOT NULL DEFAULT false;
