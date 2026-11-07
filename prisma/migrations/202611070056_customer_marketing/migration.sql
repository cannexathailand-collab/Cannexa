ALTER TABLE "Click"
 ADD COLUMN "customerLanding" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "customerEnteredAt" TIMESTAMP(3),
 ADD COLUMN "marketingCustomerCode" TEXT;

ALTER TABLE "Customer"
 ADD COLUMN "portalProfileIncomplete" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Click_customerLanding_customerEnteredAt_idx" ON "Click"("customerLanding", "customerEnteredAt");
