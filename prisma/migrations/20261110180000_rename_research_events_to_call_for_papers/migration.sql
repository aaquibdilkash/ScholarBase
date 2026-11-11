-- Preserve existing research-event records while moving the domain to call for papers.
CREATE TYPE "CallForPaperCategory" AS ENUM ('CONFERENCE', 'BOOK_CHAPTER', 'JOURNAL', 'WORKSHOP', 'SYMPOSIUM');
ALTER TYPE "EmbeddingEntityType" RENAME VALUE 'RESEARCH_EVENT' TO 'CALL_FOR_PAPER';
ALTER TABLE "public"."ResearchEvent" RENAME TO "CallForPaper";
ALTER TABLE "public"."ResearchEventBookmark" RENAME TO "CallForPaperBookmark";
ALTER TABLE "public"."ResearchEventComment" RENAME TO "CallForPaperComment";
ALTER TABLE "public"."ResearchEventCommentVote" RENAME TO "CallForPaperCommentVote";
ALTER TABLE "public"."ResearchEventVote" RENAME TO "CallForPaperVote";

ALTER TABLE "public"."CallForPaperBookmark"
  RENAME COLUMN "researchEventId" TO "callForPaperId";
ALTER TABLE "public"."CallForPaperComment"
  RENAME COLUMN "researchEventId" TO "callForPaperId";
ALTER TABLE "public"."CallForPaperVote"
  RENAME COLUMN "researchEventId" TO "callForPaperId";
ALTER TABLE "public"."CallForPaper"
  RENAME COLUMN "date" TO "eventDate";
ALTER TABLE "public"."User"
  RENAME COLUMN "researchEventCount" TO "callForPaperCount";

ALTER TABLE "public"."CallForPaper"
  ADD COLUMN "category" "CallForPaperCategory" NOT NULL DEFAULT 'CONFERENCE',
  ALTER COLUMN "eventDate" DROP NOT NULL,
  ALTER COLUMN "location" DROP NOT NULL;

UPDATE "public"."UserActivity"
SET "moduleType" = 'CALL_FOR_PAPER'
WHERE "moduleType" = 'RESEARCH_EVENT';

UPDATE "public"."UserActivity"
SET "moduleType" = 'CALL_FOR_PAPER_COMMENT'
WHERE "moduleType" = 'RESEARCH_EVENT_COMMENT';

DO $$
DECLARE
  function_definition TEXT;
BEGIN
  SELECT pg_get_functiondef('public.enqueue_embedding_job()'::regprocedure)
    INTO function_definition;
  function_definition := replace(replace(function_definition, 'ResearchEvent', 'CallForPaper'), 'RESEARCH_EVENT', 'CALL_FOR_PAPER');
  EXECUTE function_definition;
END $$;

DROP TRIGGER IF EXISTS "ResearchEvent_embedding_enqueue_trg" ON "public"."CallForPaper";
CREATE TRIGGER "CallForPaper_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "title", "category", "eventDate", "location", "description", "isDeleted"
ON "public"."CallForPaper"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

ALTER INDEX IF EXISTS "ResearchEvent_authorId_createdAt_idx"
  RENAME TO "CallForPaper_authorId_createdAt_idx";
ALTER INDEX IF EXISTS "ResearchEvent_createdAt_idx"
  RENAME TO "CallForPaper_createdAt_idx";
ALTER INDEX IF EXISTS "ResearchEvent_trendingScore_idx"
  RENAME TO "CallForPaper_trendingScore_idx";
ALTER INDEX IF EXISTS "ResearchEventBookmark_researchEventId_userId_key"
  RENAME TO "CallForPaperBookmark_callForPaperId_userId_key";
ALTER INDEX IF EXISTS "ResearchEventBookmark_userId_createdAt_idx"
  RENAME TO "CallForPaperBookmark_userId_createdAt_idx";
ALTER INDEX IF EXISTS "ResearchEventComment_researchEventId_createdAt_idx"
  RENAME TO "CallForPaperComment_callForPaperId_createdAt_idx";
ALTER INDEX IF EXISTS "ResearchEventVote_researchEventId_userId_key"
  RENAME TO "CallForPaperVote_callForPaperId_userId_key";
ALTER INDEX IF EXISTS "ResearchEvent_title_trgm_idx"
  RENAME TO "CallForPaper_title_trgm_idx";
ALTER INDEX IF EXISTS "ResearchEvent_location_trgm_idx"
  RENAME TO "CallForPaper_location_trgm_idx";
ALTER INDEX IF EXISTS "ResearchEvent_description_trgm_idx"
  RENAME TO "CallForPaper_description_trgm_idx";
CREATE INDEX IF NOT EXISTS "CallForPaper_title_trgm_idx"
  ON "public"."CallForPaper" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "CallForPaper_location_trgm_idx"
  ON "public"."CallForPaper" USING gin ("location" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "CallForPaper_description_trgm_idx"
  ON "public"."CallForPaper" USING gin ("description" gin_trgm_ops);

ALTER TABLE "public"."CallForPaper"
  RENAME CONSTRAINT "ResearchEvent_pkey" TO "CallForPaper_pkey";
ALTER TABLE "public"."CallForPaperBookmark"
  RENAME CONSTRAINT "ResearchEventBookmark_pkey" TO "CallForPaperBookmark_pkey";
ALTER TABLE "public"."CallForPaperComment"
  RENAME CONSTRAINT "ResearchEventComment_pkey" TO "CallForPaperComment_pkey";
ALTER TABLE "public"."CallForPaperCommentVote"
  RENAME CONSTRAINT "ResearchEventCommentVote_pkey" TO "CallForPaperCommentVote_pkey";
ALTER TABLE "public"."CallForPaperVote"
  RENAME CONSTRAINT "ResearchEventVote_pkey" TO "CallForPaperVote_pkey";
