DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format('ALTER TABLE %I."LineOaBrowser" ADD COLUMN "accountsUpdatedAt" TIMESTAMP(3), ADD COLUMN "accountsError" TEXT',target);
  EXECUTE format('CREATE TABLE %I."LineOaAccount" ("account" TEXT PRIMARY KEY,"name" TEXT NOT NULL,"available" BOOLEAN NOT NULL DEFAULT true,"verifiedAt" TIMESTAMP(3) NOT NULL,"updatedAt" TIMESTAMP(3) NOT NULL)',target);
  EXECUTE format('INSERT INTO %I."LineOaAccount" ("account","name","available","verifiedAt","updatedAt") SELECT "account","account",true,now(),now() FROM %I."LineOaBrowser" WHERE "status"=''READY'' ON CONFLICT DO NOTHING',target,target);
 END LOOP;
END $$;
