DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format('CREATE TABLE %I."OpenAiConnection" ("id" TEXT PRIMARY KEY, "encryptedKey" TEXT NOT NULL, "model" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL)',target);
 END LOOP;
END $$;
