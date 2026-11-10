CREATE TABLE "PlatformAdministrator" (
 "username" TEXT PRIMARY KEY,
 "active" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "PlatformShop" (
 "id" TEXT PRIMARY KEY,
 "slug" TEXT NOT NULL UNIQUE,
 "name" TEXT NOT NULL,
 "schemaName" TEXT NOT NULL UNIQUE,
 "ownerUsername" TEXT NOT NULL,
 "active" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "PlatformAuditLog" (
 "id" TEXT PRIMARY KEY,
 "actor" TEXT NOT NULL,
 "action" TEXT NOT NULL,
 "shopId" TEXT,
 "details" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "PlatformAdministrator" ("username") VALUES ('owner');
INSERT INTO "PlatformShop" ("id","slug","name","schemaName","ownerUsername") VALUES ('main','cannexa','Cannexa','public','owner');
