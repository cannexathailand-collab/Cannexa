CREATE TABLE "StockProductImage" (
 "code" TEXT NOT NULL PRIMARY KEY,
 "imageData" BYTEA NOT NULL,
 "imageMime" TEXT NOT NULL,
 "imageVersion" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "StockProductImage_image_check" CHECK (
  "imageMime" IN ('image/png','image/jpeg','image/webp')
  AND "imageVersion" ~ '^[0-9a-f]{64}$'
  AND octet_length("imageData") BETWEEN 1 AND 2097152
 )
);
