-- Replace the full-table unique constraint with a PARTIAL unique index so
-- soft-deleted recommendations (isDeleted = true) no longer block a scholar
-- from re-recommending the same supervisor. Uniqueness now applies only to
-- ACTIVE (non-deleted) rows.
ALTER TABLE "Recommendation" DROP CONSTRAINT IF EXISTS "Recommendation_authorId_supervisorId_key";
DROP INDEX IF EXISTS "Recommendation_authorId_supervisorId_key";

CREATE UNIQUE INDEX "Recommendation_active_author_supervisor_unique"
    ON "Recommendation"("authorId", "supervisorId")
    WHERE "isDeleted" = false;