DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format('ALTER TABLE %I."Customer" ADD COLUMN "registrationPhone" TEXT',target);
  EXECUTE format('UPDATE %I."Customer" SET "registrationPhone"="phone" WHERE "name" IS NULL AND "address" IS NULL AND "phone" ~ ''^0[0-9]{9}$''',target);
 END LOOP;
END $$;
