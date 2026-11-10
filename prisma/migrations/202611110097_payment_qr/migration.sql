DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format('ALTER TABLE %I."WebsitePaymentSettings" ADD COLUMN "qrImageData" BYTEA, ADD COLUMN "qrImageMime" TEXT, ADD COLUMN "qrImageVersion" TEXT',target);
 END LOOP;
END $$;
