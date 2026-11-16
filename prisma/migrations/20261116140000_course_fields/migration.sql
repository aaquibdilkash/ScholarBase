-- Learning Zone follow-ups: language, an explicit Free/Paid classification, and
-- decimal price / duration.
--
-- `pricing` is deliberately separate from `price` (the form asks for both
-- independently), so existing rows are classified from their current amount
-- without touching the amount itself: a positive price is PAID, everything else
-- is FREE.
CREATE TYPE "public"."CoursePricing" AS ENUM ('FREE', 'PAID');

ALTER TABLE "public"."Course"
ADD COLUMN "pricing" "public"."CoursePricing",
ADD COLUMN "language" TEXT;

UPDATE "public"."Course"
SET "pricing" = CASE
  WHEN "price" > 0 THEN 'PAID'::"public"."CoursePricing"
  ELSE 'FREE'::"public"."CoursePricing"
END;

ALTER TABLE "public"."Course"
ALTER COLUMN "pricing" SET NOT NULL,
ALTER COLUMN "pricing" SET DEFAULT 'FREE';

-- Prices and durations are decimals now (e.g. 9.99, 1.5 hours). The write path
-- caps both at 6 characters, so no value needs rescaling here.
ALTER TABLE "public"."Course"
ALTER COLUMN "price" TYPE DOUBLE PRECISION USING "price"::DOUBLE PRECISION,
ALTER COLUMN "durationValue" TYPE DOUBLE PRECISION USING "durationValue"::DOUBLE PRECISION;

-- `language` joins the list search, so it needs the same pg_trgm index every
-- other search field has (see test/search/trgm-index-coverage.test.ts); without
-- it PostgreSQL drops the whole search query to a sequential scan.
CREATE INDEX IF NOT EXISTS "Course_language_trgm_idx"
ON "public"."Course" USING GIN ("language" gin_trgm_ops);
