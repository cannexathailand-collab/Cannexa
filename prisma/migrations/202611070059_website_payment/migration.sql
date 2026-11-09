ALTER TABLE "WebsiteOrder"
 ADD COLUMN "paymentMethod" TEXT,
 ADD COLUMN "subtotalSatang" INTEGER,
 ADD COLUMN "shippingSatang" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "bankDetails" JSONB,
 ADD COLUMN "slipData" BYTEA,
 ADD COLUMN "slipMime" TEXT,
 ADD COLUMN "slipVersion" TEXT,
 ADD CONSTRAINT "WebsiteOrder_payment_check" CHECK ("paymentMethod" IS NULL OR "paymentMethod" IN ('TRANSFER','COD')),
 ADD CONSTRAINT "WebsiteOrder_shipping_check" CHECK ("shippingSatang" >= 0),
 ADD CONSTRAINT "WebsiteOrder_subtotal_check" CHECK ("subtotalSatang" IS NULL OR "subtotalSatang" > 0),
 ADD CONSTRAINT "WebsiteOrder_payment_total_check" CHECK ("paymentMethod" IS NULL OR ("subtotalSatang" IS NOT NULL AND "totalSatang" = "subtotalSatang" + "shippingSatang")),
 ADD CONSTRAINT "WebsiteOrder_slip_size_check" CHECK ("slipData" IS NULL OR octet_length("slipData") <= 2097152);

CREATE TABLE "WebsitePaymentSettings" (
 "id" TEXT NOT NULL DEFAULT 'active' PRIMARY KEY,
 "bankName" TEXT NOT NULL DEFAULT '',
 "accountName" TEXT NOT NULL DEFAULT '',
 "accountNumber" TEXT NOT NULL DEFAULT '',
 "version" TEXT NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
