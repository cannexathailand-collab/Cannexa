DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format('ALTER TABLE %I."TaxInvoiceSettings" ADD COLUMN IF NOT EXISTS "priceMode" TEXT NOT NULL DEFAULT ''INCLUSIVE'' CHECK ("priceMode" IN (''INCLUSIVE'',''EXCLUSIVE''))',target);
 END LOOP;
END $$;
