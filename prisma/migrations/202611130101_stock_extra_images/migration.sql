DO $$
DECLARE target text;
BEGIN
 FOR target IN SELECT nspname FROM pg_namespace WHERE nspname='public' OR nspname ~ '^shop_[a-f0-9]{32}$' LOOP
  EXECUTE format($table$CREATE TABLE %I."StockProductExtraImage" (
 "code" TEXT NOT NULL,
 "slot" INTEGER NOT NULL CHECK ("slot" IN (2, 3)),
 "imageData" BYTEA NOT NULL,
 "imageMime" TEXT NOT NULL,
 "imageVersion" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "StockProductExtraImage_pkey" PRIMARY KEY ("code", "slot")
)$table$,target);
 END LOOP;
END $$;
