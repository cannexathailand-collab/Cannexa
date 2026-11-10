DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format('CREATE TABLE %I."StoreBranding" ("id" TEXT PRIMARY KEY DEFAULT ''active'', "name" TEXT NOT NULL DEFAULT '''', "color" TEXT NOT NULL DEFAULT ''#087c59'', "footer" TEXT NOT NULL DEFAULT '''', "logoVersion" TEXT, "version" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL)',target);
  EXECUTE format('CREATE TABLE %I."StoreBrandAsset" ("id" TEXT PRIMARY KEY, "imageData" BYTEA NOT NULL, "imageMime" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)',target);
  EXECUTE format('CREATE TABLE %I."TaxInvoiceSettings" ("id" TEXT PRIMARY KEY DEFAULT ''active'', "enabled" BOOLEAN NOT NULL DEFAULT false, "registeredOn" TIMESTAMP(3), "branchCode" TEXT NOT NULL DEFAULT ''00000'', "vatRateBps" INTEGER NOT NULL DEFAULT 700, "version" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL)',target);
  EXECUTE format('CREATE TABLE %I."TaxInvoiceCounter" ("year" INTEGER PRIMARY KEY, "number" INTEGER NOT NULL DEFAULT 0)',target);
  EXECUTE format('CREATE TABLE %I."CustomerTaxInvoice" ("id" TEXT PRIMARY KEY, "number" TEXT NOT NULL UNIQUE, "orderId" TEXT NOT NULL UNIQUE, "customerCode" TEXT, "fingerprint" TEXT NOT NULL, "snapshot" JSONB NOT NULL, "netSatang" INTEGER NOT NULL, "vatSatang" INTEGER NOT NULL, "totalSatang" INTEGER NOT NULL CHECK ("totalSatang">0 AND "netSatang"+"vatSatang"="totalSatang"), "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)',target);
  EXECUTE format('CREATE INDEX "CustomerTaxInvoice_customerCode_issuedAt_idx" ON %I."CustomerTaxInvoice" ("customerCode","issuedAt")',target);
 END LOOP;
END $$;
