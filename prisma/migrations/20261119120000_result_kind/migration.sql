-- Exams & Results: rename the module's table and teach it about exam
-- notifications.
--
-- The table rename keeps every existing row, index, foreign key and trigger
-- attached; only their names need the follow-up statements below so a future
-- `prisma migrate diff` does not report stale identifiers.

-- CreateEnum
CREATE TYPE "ResultKind" AS ENUM ('RESULT_NOTIFICATION', 'EXAM_NOTIFICATION');

-- AlterTable
ALTER TABLE "public"."Result"
  ADD COLUMN "kind" "ResultKind" NOT NULL DEFAULT 'RESULT_NOTIFICATION';

-- AlterTable
ALTER TABLE "public"."Result"
  RENAME COLUMN "resultLink" TO "checkOrApplyLink";

-- RenameTable
ALTER TABLE "public"."Result" RENAME TO "ExamsAndResults";

-- RenameConstraints
ALTER TABLE "public"."ExamsAndResults"
  RENAME CONSTRAINT "Result_pkey" TO "ExamsAndResults_pkey";

ALTER TABLE "public"."ExamsAndResults"
  RENAME CONSTRAINT "Result_authorId_fkey" TO "ExamsAndResults_authorId_fkey";

-- RenameIndexes (Prisma-generated)
ALTER INDEX IF EXISTS "Result_createdAt_idx"
  RENAME TO "ExamsAndResults_createdAt_idx";

ALTER INDEX IF EXISTS "Result_authorId_createdAt_idx"
  RENAME TO "ExamsAndResults_authorId_createdAt_idx";

ALTER INDEX IF EXISTS "Result_trendingScore_idx"
  RENAME TO "ExamsAndResults_trendingScore_idx";

-- RenameIndexes (created by raw SQL in earlier migrations)
ALTER INDEX IF EXISTS "Result_title_trgm_idx"
  RENAME TO "ExamsAndResults_title_trgm_idx";

ALTER INDEX IF EXISTS "Result_description_trgm_idx"
  RENAME TO "ExamsAndResults_description_trgm_idx";

ALTER INDEX IF EXISTS "Result_category_trgm_idx"
  RENAME TO "ExamsAndResults_category_trgm_idx";

ALTER INDEX IF EXISTS "Result_conductingBody_trgm_idx"
  RENAME TO "ExamsAndResults_conductingBody_trgm_idx";

ALTER INDEX IF EXISTS "Result_session_trgm_idx"
  RENAME TO "ExamsAndResults_session_trgm_idx";

ALTER INDEX IF EXISTS "Result_embedding_hnsw_idx"
  RENAME TO "ExamsAndResults_embedding_hnsw_idx";

-- The embedding outbox trigger dispatches on TG_TABLE_NAME and raises for an
-- unhandled table, so the renamed table must be added to the function before
-- the first write. Recreate the function from its live definition rather than
-- duplicating the body, as the earlier module renames do.
DO $$
DECLARE
  function_definition TEXT;
BEGIN
  SELECT pg_get_functiondef('public.enqueue_embedding_job()'::regprocedure)
    INTO function_definition;
  function_definition := replace(
    function_definition,
    'WHEN ''Result'' THEN',
    'WHEN ''ExamsAndResults'' THEN'
  );
  EXECUTE function_definition;
END $$;

DROP TRIGGER IF EXISTS "Result_embedding_enqueue_trg" ON "public"."ExamsAndResults";
CREATE TRIGGER "ExamsAndResults_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF
    "title",
    "description",
    "category",
    "conductingBody",
    "session",
    "isDeleted"
ON "public"."ExamsAndResults"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();
