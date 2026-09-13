ALTER TABLE "User"
ADD COLUMN "deletedByType" "DeletedByType",
ADD COLUMN "deletedById" TEXT;

UPDATE "User"
SET "deletedByType" = 'AUTHOR'
WHERE "isDeleted" = true
  AND "deletedByType" IS NULL;
