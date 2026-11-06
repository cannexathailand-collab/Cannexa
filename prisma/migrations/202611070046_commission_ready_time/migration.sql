ALTER TABLE "SalesOrder" ADD COLUMN "commissionReadyAt" TIMESTAMP(3);
ALTER TABLE "AdditionalCommission" ADD COLUMN "commissionReadyAt" TIMESTAMP(3);
UPDATE "SalesOrder" s SET "commissionReadyAt" = GREATEST(
 s."createdAt",
 CASE WHEN s."paymentMethod" = 'COD' THEN COALESCE((SELECT g."importedAt" FROM "CodReceipt" r LEFT JOIN "GmailImport" g ON g.id=r."importId" WHERE r.tracking=s.tracking),s."recognizedAt",s."createdAt") ELSE s."createdAt" END,
 CASE WHEN s."commissionBasis" IN ('PROFIT','GROSS_PROFIT') THEN COALESCE((SELECT d."processedAt" FROM "StockDispatch" d WHERE d."orderId"=s."orderId"),s."createdAt") ELSE s."createdAt" END,
 CASE WHEN s."commissionBasis"='GROSS_PROFIT' THEN COALESCE((SELECT g."importedAt" FROM "Shipment" h LEFT JOIN "GmailImport" g ON g.id=h."freightImportId" WHERE h."orderId"=s."orderId"),s."createdAt") ELSE s."createdAt" END
) WHERE s.status IN ('PENDING','PAID') AND s."commissionSatang" IS NOT NULL;
UPDATE "AdditionalCommission" a SET "commissionReadyAt" = GREATEST(a."createdAt",COALESCE((SELECT s."commissionReadyAt" FROM "SalesOrder" s WHERE s."orderId"=a."orderId"),a."createdAt"),CASE WHEN a.basis IN ('PROFIT','GROSS_PROFIT') THEN COALESCE((SELECT d."processedAt" FROM "StockDispatch" d WHERE d."orderId"=a."orderId"),a."createdAt") ELSE a."createdAt" END,CASE WHEN a.basis='GROSS_PROFIT' THEN COALESCE((SELECT g."importedAt" FROM "Shipment" h LEFT JOIN "GmailImport" g ON g.id=h."freightImportId" WHERE h."orderId"=a."orderId"),a."createdAt") ELSE a."createdAt" END) WHERE a.status IN ('PENDING','PAID') AND a."amountSatang" IS NOT NULL;
CREATE INDEX "SalesOrder_affiliateId_commissionReadyAt_idx" ON "SalesOrder"("affiliateId","commissionReadyAt");
CREATE INDEX "AdditionalCommission_affiliateId_commissionReadyAt_idx" ON "AdditionalCommission"("affiliateId","commissionReadyAt");
