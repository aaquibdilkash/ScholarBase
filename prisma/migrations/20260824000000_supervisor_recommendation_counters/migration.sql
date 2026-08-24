-- Materialized recommendation aggregates on Supervisor (Zero-Compute reads)
ALTER TABLE "Supervisor" ADD COLUMN     "recommendationCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Supervisor" ADD COLUMN     "ratingSum"           INTEGER NOT NULL DEFAULT 0;

-- One-time backfill from existing non-deleted recommendations
UPDATE "Supervisor" s
SET "recommendationCount" = agg.cnt,
    "ratingSum"           = agg.sum
FROM (
    SELECT "supervisorId", COUNT(*)::int AS cnt, COALESCE(SUM("rating"), 0)::int AS sum
    FROM "Recommendation"
    WHERE "isDeleted" = false
    GROUP BY "supervisorId"
) agg
WHERE s."id" = agg."supervisorId";