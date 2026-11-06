CREATE TABLE "OrderMessageTemplate" (
 "id" TEXT NOT NULL,
 "name" TEXT NOT NULL,
 "body" TEXT NOT NULL,
 "active" BOOLEAN NOT NULL DEFAULT true,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "OrderMessageTemplate_pkey" PRIMARY KEY ("id")
);
