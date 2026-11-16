-- Department/faculty is optional: an admission notice can apply to an entire
-- institution, or cover several departments. Existing rows keep their value;
-- legacy empty strings are normalised to NULL so the column never mixes "" and
-- NULL for "not provided".
ALTER TABLE "public"."Admission" ALTER COLUMN "department" DROP NOT NULL;

UPDATE "public"."Admission"
SET "department" = NULL
WHERE btrim("department") = '';

-- City/state/country of the institution, also optional. The list search adds
-- this column, so it needs the same pg_trgm index every other search field has
-- (see test/search/trgm-index-coverage.test.ts); without it PostgreSQL drops
-- the whole search query to a sequential scan.
ALTER TABLE "public"."Admission"
ADD COLUMN "location" TEXT;

CREATE INDEX IF NOT EXISTS "Admission_location_trgm_idx"
ON "public"."Admission" USING GIN ("location" gin_trgm_ops);
