DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format('CREATE TABLE %I."ReceiptSettings" ("id" TEXT PRIMARY KEY DEFAULT ''active'', "name" TEXT NOT NULL, "address" TEXT NOT NULL, "phone" TEXT NOT NULL DEFAULT '''', "taxId" TEXT NOT NULL DEFAULT '''', "enabled" BOOLEAN NOT NULL DEFAULT false, "version" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL)',target);
  EXECUTE format('CREATE TABLE %I."ReceiptCounter" ("year" INTEGER PRIMARY KEY, "number" INTEGER NOT NULL DEFAULT 0)',target);
  EXECUTE format('CREATE TABLE %I."CustomerReceipt" ("id" TEXT PRIMARY KEY, "number" TEXT NOT NULL UNIQUE, "orderId" TEXT NOT NULL UNIQUE, "customerCode" TEXT, "amountSatang" INTEGER NOT NULL CHECK ("amountSatang">0), "snapshot" JSONB NOT NULL, "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)',target);
  EXECUTE format('CREATE INDEX "CustomerReceipt_customerCode_issuedAt_idx" ON %I."CustomerReceipt" ("customerCode","issuedAt")',target);
 END LOOP;
END $$;
