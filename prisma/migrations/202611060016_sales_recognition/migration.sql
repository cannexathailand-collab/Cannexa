ALTER TABLE "SalesOrder" ADD COLUMN "recognizedAt" TIMESTAMP(3);
ALTER TABLE "Shipment" ADD COLUMN "fulfillmentStatus" TEXT NOT NULL DEFAULT 'UNCONFIRMED', ADD COLUMN "dispatchedAt" TIMESTAMP(3), ADD COLUMN "dispatchEvidence" TEXT, ADD COLUMN "dispatchConfirmedBy" TEXT;
UPDATE "Shipment" SET "fulfillmentStatus" = "status" WHERE "status" IN ('RETURNED','CANCELLED');
CREATE INDEX "Shipment_fulfillmentStatus_dispatchedAt_idx" ON "Shipment"("fulfillmentStatus","dispatchedAt");
CREATE INDEX "SalesOrder_recognizedAt_status_idx" ON "SalesOrder"("recognizedAt","status");
