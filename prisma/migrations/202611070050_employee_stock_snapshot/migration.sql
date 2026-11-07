CREATE TABLE "EmployeeStockSnapshot" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "rows" JSONB NOT NULL,
 "fetchedAt" TIMESTAMP(3) NOT NULL
);
