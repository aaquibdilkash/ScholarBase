-- Repair legacy ratings that bypassed the 1–5 validation and rebuild the
-- materialized aggregates from the canonical, non-deleted rows.
UPDATE "Recommendation"
SET rating = LEAST(GREATEST(rating, 1), 5)
WHERE rating < 1 OR rating > 5;

UPDATE "JournalReview"
SET rating = LEAST(GREATEST(rating, 1), 5)
WHERE rating < 1 OR rating > 5;

UPDATE "Supervisor" AS s
SET
  "recommendationCount" = aggregates.recommendation_count,
  "ratingSum" = aggregates.rating_sum
FROM (
  SELECT
    "supervisorId",
    COUNT(*)::int AS recommendation_count,
    COALESCE(SUM(rating), 0)::int AS rating_sum
  FROM "Recommendation"
  WHERE "isDeleted" = false
  GROUP BY "supervisorId"
) AS aggregates
WHERE s.id = aggregates."supervisorId";

UPDATE "Supervisor"
SET "recommendationCount" = 0, "ratingSum" = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM "Recommendation"
  WHERE "Recommendation"."supervisorId" = "Supervisor".id
    AND "Recommendation"."isDeleted" = false
);

UPDATE "Journal" AS j
SET
  "reviewCount" = aggregates.review_count,
  "ratingSum" = aggregates.rating_sum
FROM (
  SELECT
    "journalId",
    COUNT(*)::int AS review_count,
    COALESCE(SUM(rating), 0)::int AS rating_sum
  FROM "JournalReview"
  WHERE "isDeleted" = false
  GROUP BY "journalId"
) AS aggregates
WHERE j.id = aggregates."journalId";

UPDATE "Journal"
SET "reviewCount" = 0, "ratingSum" = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM "JournalReview"
  WHERE "JournalReview"."journalId" = "Journal".id
    AND "JournalReview"."isDeleted" = false
);
