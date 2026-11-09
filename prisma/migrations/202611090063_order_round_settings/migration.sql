CREATE TABLE "OrderRoundSettings" (
    "id" TEXT NOT NULL,
    "closeMinutes" INTEGER NOT NULL DEFAULT 720,
    "version" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderRoundSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderRoundSettings_closeMinutes_check" CHECK ("closeMinutes" >= 0 AND "closeMinutes" < 1440)
);
