DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format('ALTER TABLE %I."Customer" ADD COLUMN "portalUsername" TEXT',target);
  EXECUTE format('CREATE UNIQUE INDEX "Customer_portalUsername_key" ON %I."Customer" ("portalUsername")',target);
 END LOOP;
END $$;
