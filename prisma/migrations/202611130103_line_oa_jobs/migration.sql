DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format('CREATE TABLE %I."LineOaBrowser" ("id" TEXT PRIMARY KEY,"encryptedConfig" TEXT NOT NULL,"contextId" TEXT,"sessionId" TEXT,"sessionExpiresAt" TIMESTAMP(3),"account" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT ''DISCONNECTED'',"leaseUntil" TIMESTAMP(3),"heartbeatAt" TIMESTAMP(3),"screenshotData" BYTEA,"updatedAt" TIMESTAMP(3) NOT NULL)',target);
  EXECUTE format('CREATE TABLE %I."LineOaBrowserCommand" ("id" TEXT PRIMARY KEY,"sessionId" TEXT NOT NULL,"encryptedPayload" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)',target);
  EXECUTE format('CREATE INDEX "LineOaBrowserCommand_sessionId_createdAt_idx" ON %I."LineOaBrowserCommand" ("sessionId","createdAt")',target);
  EXECUTE format('CREATE TABLE %I."LineOaJob" ("id" TEXT PRIMARY KEY,"requestKey" TEXT NOT NULL UNIQUE,"actor" TEXT NOT NULL,"account" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT ''QUEUED'',"phase" TEXT NOT NULL DEFAULT ''RESEARCH'',"cursor" INTEGER NOT NULL DEFAULT 0,"payload" JSONB NOT NULL,"results" JSONB NOT NULL,"error" TEXT,"leaseUntil" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL)',target);
  EXECUTE format('CREATE INDEX "LineOaJob_status_createdAt_idx" ON %I."LineOaJob" ("status","createdAt")',target);
  EXECUTE format('CREATE TABLE %I."LineOaArtifact" ("account" TEXT NOT NULL,"kind" TEXT NOT NULL,"key" TEXT NOT NULL,"remoteId" TEXT NOT NULL,"fingerprint" TEXT NOT NULL,"updatedAt" TIMESTAMP(3) NOT NULL,PRIMARY KEY("account","kind","key"))',target);
 END LOOP;
END $$;
