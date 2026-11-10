DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format('CREATE TABLE %I."CustomerDeliveryAddress" ("id" TEXT PRIMARY KEY, "customerCode" TEXT NOT NULL REFERENCES %I."Customer"("code") ON DELETE CASCADE ON UPDATE CASCADE, "fingerprint" TEXT NOT NULL, "name" TEXT NOT NULL, "address" TEXT NOT NULL, "phone" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)',target,target);
  EXECUTE format('CREATE UNIQUE INDEX "CustomerDeliveryAddress_customerCode_fingerprint_key" ON %I."CustomerDeliveryAddress" ("customerCode","fingerprint")',target);
  EXECUTE format('CREATE INDEX "CustomerDeliveryAddress_customerCode_updatedAt_idx" ON %I."CustomerDeliveryAddress" ("customerCode","updatedAt")',target);
 END LOOP;
END $$;
