ALTER TABLE "StockSheetsConnection" ADD COLUMN "spreadsheetId" TEXT;

DO $$
DECLARE shop_schema TEXT;
BEGIN
 FOR shop_schema IN SELECT "schemaName" FROM "PlatformShop" WHERE "schemaName" <> 'public'
 LOOP
  IF shop_schema !~ '^shop_[a-f0-9]{32}$' THEN
   RAISE EXCEPTION 'Invalid shop schema';
  END IF;
  EXECUTE format('ALTER TABLE %I."StockSheetsConnection" ADD COLUMN IF NOT EXISTS "spreadsheetId" TEXT', shop_schema);
 END LOOP;
END $$;
