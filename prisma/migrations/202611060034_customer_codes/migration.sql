CREATE SEQUENCE "customer_code_seq" AS bigint MINVALUE 1 MAXVALUE 99999999 NO CYCLE;
CREATE FUNCTION customer_code() RETURNS text LANGUAGE sql VOLATILE AS $$
 SELECT 'CUS-' || lpad(nextval('"customer_code_seq"')::text, 8, '0')
$$;
ALTER TABLE "Conversion" ADD COLUMN "customerCode" TEXT NOT NULL DEFAULT customer_code();
CREATE UNIQUE INDEX "Conversion_customerCode_key" ON "Conversion"("customerCode");
ALTER TABLE "OrderIntake" ADD COLUMN "customerCode" TEXT;
ALTER TABLE "OrderIntake" ADD CONSTRAINT "OrderIntake_customerCode_fkey" FOREIGN KEY ("customerCode") REFERENCES "Conversion"("customerCode") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "OrderIntake_customerCode_idx" ON "OrderIntake"("customerCode");
