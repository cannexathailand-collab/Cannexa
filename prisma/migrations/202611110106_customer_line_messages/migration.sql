DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format('ALTER TABLE %I."LineMessageRecipient" ADD COLUMN "friendFlag" BOOLEAN, ADD COLUMN "friendshipAt" TIMESTAMP(3), ADD COLUMN "lastMessageAt" TIMESTAMP(3)',target);
  EXECUTE format('CREATE TABLE %I."CustomerLineMessage" ("id" TEXT PRIMARY KEY,"customerCode" TEXT NOT NULL,"lineUserKey" TEXT NOT NULL,"botId" TEXT NOT NULL,"payloadHash" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT ''PENDING'',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL)',target);
 END LOOP;
END $$;
