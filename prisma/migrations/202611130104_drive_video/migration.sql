DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format('CREATE TABLE %I."DriveConnection" ("id" TEXT PRIMARY KEY DEFAULT ''active'',"encryptedConfig" TEXT NOT NULL,"revision" TEXT NOT NULL,"encryptedToken" TEXT,"email" TEXT,"folderId" TEXT,"connectedAt" TIMESTAMP(3),"updatedAt" TIMESTAMP(3) NOT NULL)',target);
  EXECUTE format('CREATE TABLE %I."DriveOAuthAttempt" ("stateHash" TEXT PRIMARY KEY,"browserHash" TEXT NOT NULL,"actor" TEXT NOT NULL,"actorVersion" TEXT NOT NULL,"revision" TEXT NOT NULL,"verifier" TEXT NOT NULL,"expiresAt" TIMESTAMP(3) NOT NULL,"consumedAt" TIMESTAMP(3))',target);
 END LOOP;
END $$;
