DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format('ALTER TABLE %I."CustomerAccessLink" ALTER COLUMN "expiresAt" DROP NOT NULL',target);
 END LOOP;
END $$;
