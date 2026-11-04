ALTER TABLE "OAuthAttempt" ADD COLUMN "lineRevision" TEXT;
CREATE TABLE "LineConnection" ("id" TEXT PRIMARY KEY, "encrypted" TEXT NOT NULL, "revision" TEXT NOT NULL);
