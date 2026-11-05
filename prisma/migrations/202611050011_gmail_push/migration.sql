ALTER TABLE "GmailConnection" ADD COLUMN "topicName" TEXT, ADD COLUMN "watchExpiresAt" TIMESTAMP(3), ADD COLUMN "historyId" TEXT, ADD COLUMN "lastPushAt" TIMESTAMP(3);
WITH canonical AS (SELECT "id", FIRST_VALUE("id") OVER (PARTITION BY "messageId", "filename" ORDER BY "importedAt", "id") AS keep FROM "GmailImport") UPDATE "Shipment" s SET "importId"=c.keep FROM canonical c WHERE s."importId"=c."id";
WITH canonical AS (SELECT "id", FIRST_VALUE("id") OVER (PARTITION BY "messageId", "filename" ORDER BY "importedAt", "id") AS keep FROM "GmailImport") UPDATE "CodReceipt" s SET "importId"=c.keep FROM canonical c WHERE s."importId"=c."id";
WITH ranked AS (SELECT "id", ROW_NUMBER() OVER (PARTITION BY "messageId", "filename" ORDER BY "importedAt", "id") AS n FROM "GmailImport") DELETE FROM "GmailImport" WHERE "id" IN (SELECT "id" FROM ranked WHERE n>1);
CREATE UNIQUE INDEX "GmailImport_messageId_filename_key" ON "GmailImport"("messageId","filename");
