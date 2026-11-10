CREATE TABLE "PlatformJobCursor" (
 "id" TEXT NOT NULL,
 "nextOffset" INTEGER NOT NULL DEFAULT 0,
 CONSTRAINT "PlatformJobCursor_pkey" PRIMARY KEY ("id")
);
