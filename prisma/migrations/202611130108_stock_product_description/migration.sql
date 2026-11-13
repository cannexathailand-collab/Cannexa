CREATE TABLE "StockProductDescription" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "linkUrl" TEXT NOT NULL DEFAULT '',
    "editedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StockProductDescription_pkey" PRIMARY KEY ("code")
);
