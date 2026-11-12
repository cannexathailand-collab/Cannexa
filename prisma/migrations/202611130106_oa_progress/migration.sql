DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format('ALTER TABLE %I."LineOaJob" ADD COLUMN "progressMessage" TEXT, ADD COLUMN "progressAt" TIMESTAMP(3), ADD COLUMN "progressLog" JSONB NOT NULL DEFAULT ''[]''',target);
 END LOOP;
END $$;
