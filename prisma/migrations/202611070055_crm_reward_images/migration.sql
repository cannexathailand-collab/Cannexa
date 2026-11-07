ALTER TABLE "CrmReward"
 ADD COLUMN "imageData" BYTEA,
 ADD COLUMN "imageMime" TEXT,
 ADD COLUMN "imageVersion" TEXT,
 ADD COLUMN "expiresAt" TIMESTAMP(3),
 ADD CONSTRAINT "CrmReward_image_check" CHECK (
  ("imageData" IS NULL AND "imageMime" IS NULL AND "imageVersion" IS NULL)
  OR
  ("imageData" IS NOT NULL AND "imageMime" IS NOT NULL AND "imageMime" IN ('image/png','image/jpeg','image/webp')
   AND "imageVersion" IS NOT NULL AND "imageVersion" ~ '^[0-9a-f]{64}$'
   AND octet_length("imageData") BETWEEN 1 AND 2097152)
 );
