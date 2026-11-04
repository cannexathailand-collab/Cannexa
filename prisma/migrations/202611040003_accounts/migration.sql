CREATE TABLE "UserAccount" (
 "username" TEXT PRIMARY KEY,
 "role" TEXT NOT NULL,
 "salt" TEXT NOT NULL,
 "hash" TEXT NOT NULL,
 "version" TEXT NOT NULL,
 "active" BOOLEAN NOT NULL DEFAULT true,
 "affiliateId" TEXT REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CHECK ("role" IN ('owner','admin','manager','viewer','employee')),
 CHECK (("role" = 'employee') = ("affiliateId" IS NOT NULL))
);
