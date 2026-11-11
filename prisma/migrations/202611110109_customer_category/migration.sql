DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format('ALTER TABLE %I."Customer" ADD COLUMN "customerCategory" TEXT',target);
  EXECUTE format('ALTER TABLE %I."Customer" ADD COLUMN "businessLicenseNumber" TEXT',target);
 END LOOP;
END $$;
