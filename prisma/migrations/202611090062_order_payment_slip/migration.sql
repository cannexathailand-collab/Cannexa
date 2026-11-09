CREATE TABLE "OrderPaymentSlip" (
    "orderId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderPaymentSlip_pkey" PRIMARY KEY ("orderId")
);

ALTER TABLE "OrderPaymentSlip" ADD CONSTRAINT "OrderPaymentSlip_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "OrderIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
