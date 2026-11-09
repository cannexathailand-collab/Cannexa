ALTER TABLE "Shipment" ADD COLUMN "manualImportId" TEXT;
CREATE TABLE "ManualShipmentImport" (
 "id" TEXT PRIMARY KEY,
 "fingerprint" TEXT NOT NULL,
 "filename" TEXT NOT NULL,
 "rows" JSONB NOT NULL,
 "dispatchedAt" TIMESTAMP(3) NOT NULL,
 "createdBy" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
