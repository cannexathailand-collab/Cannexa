ALTER TABLE "CodReceipt" ADD COLUMN "recipient" TEXT;
UPDATE "CodReceipt" AS receipt SET "recipient" = shipment."recipient"
FROM "Shipment" AS shipment
WHERE receipt."tracking" = shipment."tracking" AND length(trim(shipment."recipient")) > 0;
