ALTER TABLE "Course"
ADD COLUMN "durationValue" INTEGER,
ADD COLUMN "durationUnit" TEXT;

UPDATE "Course"
SET
  "durationValue" = (regexp_match(trim("duration"), '^([0-9]+)[[:space:]]+(.+)$'))[1]::INTEGER,
  "durationUnit" = (regexp_match(trim("duration"), '^([0-9]+)[[:space:]]+(.+)$'))[2]
WHERE "duration" IS NOT NULL
  AND trim("duration") ~ '^[0-9]+[[:space:]]+.+$';

ALTER TABLE "Course"
DROP COLUMN "duration";
