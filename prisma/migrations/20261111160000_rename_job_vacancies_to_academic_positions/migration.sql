-- Move the job-vacancy module to academic positions: postdocs, research staff,
-- faculty, PhD researcher roles, and other appointments. `positionType` gets
-- the `OTHER` default so pre-existing rows stay valid without guessing intent.

CREATE TYPE "PositionType" AS ENUM ('POSTDOC', 'RESEARCH_ASSISTANT', 'RESEARCH_ASSOCIATE', 'FACULTY', 'PHD_RESEARCHER', 'OTHER');

ALTER TYPE "EmbeddingEntityType" RENAME VALUE 'JOB_VACANCY' TO 'ACADEMIC_POSITION';

ALTER TABLE "public"."JobVacancy" RENAME TO "AcademicPosition";
ALTER TABLE "public"."JobVacancyBookmark" RENAME TO "AcademicPositionBookmark";
ALTER TABLE "public"."JobVacancyComment" RENAME TO "AcademicPositionComment";
ALTER TABLE "public"."JobVacancyCommentVote" RENAME TO "AcademicPositionCommentVote";
ALTER TABLE "public"."JobVacancyVote" RENAME TO "AcademicPositionVote";

ALTER TABLE "public"."AcademicPositionBookmark"
  RENAME COLUMN "jobVacancyId" TO "academicPositionId";
ALTER TABLE "public"."AcademicPositionComment"
  RENAME COLUMN "jobVacancyId" TO "academicPositionId";
ALTER TABLE "public"."AcademicPositionVote"
  RENAME COLUMN "jobVacancyId" TO "academicPositionId";
ALTER TABLE "public"."User"
  RENAME COLUMN "jobVacancyCount" TO "academicPositionCount";

ALTER TABLE "public"."AcademicPosition"
  ADD COLUMN "positionType" "PositionType" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "salaryOrStipend" TEXT,
  ADD COLUMN "contractDuration" TEXT,
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "location" TEXT,
  ADD COLUMN "isRemote" BOOLEAN NOT NULL DEFAULT false;

-- Activity rows store the module key verbatim; rewrite the old spelling so the
-- activity feed and hide/restore helpers keep matching existing rows.
UPDATE "public"."UserActivity"
SET "moduleType" = 'ACADEMIC_POSITION'
WHERE "moduleType" = 'JOB_VACANCY';

UPDATE "public"."UserActivity"
SET "moduleType" = 'ACADEMIC_POSITION_COMMENT'
WHERE "moduleType" = 'JOB_VACANCY_COMMENT';

UPDATE "public"."Report"
SET "module" = 'ACADEMIC_POSITION'
WHERE "module" = 'JOB_VACANCY';

UPDATE "public"."Report"
SET "module" = 'ACADEMIC_POSITION_COMMENT'
WHERE "module" = 'JOB_VACANCY_COMMENT';

UPDATE "public"."Appeal"
SET "module" = 'ACADEMIC_POSITION'
WHERE "module" = 'JOB_VACANCY';

UPDATE "public"."Appeal"
SET "module" = 'ACADEMIC_POSITION_COMMENT'
WHERE "module" = 'JOB_VACANCY_COMMENT';

-- Rewrite the outbox trigger's table name and entity enum, and include the new
-- position fields in the embedded text. The function body is read back rather
-- than duplicated so every other module keeps its current definition.
DO $$
DECLARE
  function_definition TEXT;
BEGIN
  SELECT pg_get_functiondef('public.enqueue_embedding_job()'::regprocedure)
    INTO function_definition;
  function_definition := replace(
    replace(function_definition, 'JobVacancy', 'AcademicPosition'),
    'JOB_VACANCY',
    'ACADEMIC_POSITION'
  );
  function_definition := replace(
    function_definition,
    E'                NEW."title",\n                NEW."institution",\n                NEW."department",\n                NEW."subject",\n                NEW."description"',
    E'                NEW."title",\n                NEW."institution",\n                NEW."department",\n                NEW."subject",\n                NEW."positionType",\n                NEW."salaryOrStipend",\n                NEW."contractDuration",\n                NEW."location",\n                NEW."description"'
  );
  EXECUTE function_definition;
END $$;

DROP TRIGGER IF EXISTS "JobVacancy_embedding_enqueue_trg" ON "public"."AcademicPosition";
CREATE TRIGGER "AcademicPosition_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF
  "title",
  "institution",
  "department",
  "subject",
  "positionType",
  "salaryOrStipend",
  "contractDuration",
  "location",
  "description",
  "isDeleted"
ON "public"."AcademicPosition"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

ALTER INDEX IF EXISTS "JobVacancy_authorId_createdAt_idx"
  RENAME TO "AcademicPosition_authorId_createdAt_idx";
ALTER INDEX IF EXISTS "JobVacancy_createdAt_idx"
  RENAME TO "AcademicPosition_createdAt_idx";
ALTER INDEX IF EXISTS "JobVacancy_trendingScore_idx"
  RENAME TO "AcademicPosition_trendingScore_idx";
ALTER INDEX IF EXISTS "JobVacancyBookmark_jobVacancyId_userId_key"
  RENAME TO "AcademicPositionBookmark_academicPositionId_userId_key";
ALTER INDEX IF EXISTS "JobVacancyBookmark_userId_createdAt_idx"
  RENAME TO "AcademicPositionBookmark_userId_createdAt_idx";
ALTER INDEX IF EXISTS "JobVacancyComment_jobVacancyId_createdAt_idx"
  RENAME TO "AcademicPositionComment_academicPositionId_createdAt_idx";
ALTER INDEX IF EXISTS "JobVacancyCommentVote_commentId_userId_key"
  RENAME TO "AcademicPositionCommentVote_commentId_userId_key";
ALTER INDEX IF EXISTS "JobVacancyVote_jobVacancyId_userId_key"
  RENAME TO "AcademicPositionVote_academicPositionId_userId_key";
ALTER INDEX IF EXISTS "JobVacancy_title_trgm_idx"
  RENAME TO "AcademicPosition_title_trgm_idx";
ALTER INDEX IF EXISTS "JobVacancy_institution_trgm_idx"
  RENAME TO "AcademicPosition_institution_trgm_idx";
ALTER INDEX IF EXISTS "JobVacancy_department_trgm_idx"
  RENAME TO "AcademicPosition_department_trgm_idx";
ALTER INDEX IF EXISTS "JobVacancy_subject_trgm_idx"
  RENAME TO "AcademicPosition_subject_trgm_idx";
ALTER INDEX IF EXISTS "JobVacancy_description_trgm_idx"
  RENAME TO "AcademicPosition_description_trgm_idx";
ALTER INDEX IF EXISTS "JobVacancy_embedding_hnsw_idx"
  RENAME TO "AcademicPosition_embedding_hnsw_idx";
CREATE INDEX IF NOT EXISTS "AcademicPosition_title_trgm_idx"
  ON "public"."AcademicPosition" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "AcademicPosition_institution_trgm_idx"
  ON "public"."AcademicPosition" USING gin ("institution" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "AcademicPosition_department_trgm_idx"
  ON "public"."AcademicPosition" USING gin ("department" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "AcademicPosition_subject_trgm_idx"
  ON "public"."AcademicPosition" USING gin ("subject" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "AcademicPosition_location_trgm_idx"
  ON "public"."AcademicPosition" USING gin ("location" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "AcademicPosition_description_trgm_idx"
  ON "public"."AcademicPosition" USING gin ("description" gin_trgm_ops);

ALTER TABLE "public"."AcademicPosition"
  RENAME CONSTRAINT "JobVacancy_pkey" TO "AcademicPosition_pkey";
ALTER TABLE "public"."AcademicPositionBookmark"
  RENAME CONSTRAINT "JobVacancyBookmark_pkey" TO "AcademicPositionBookmark_pkey";
ALTER TABLE "public"."AcademicPositionComment"
  RENAME CONSTRAINT "JobVacancyComment_pkey" TO "AcademicPositionComment_pkey";
ALTER TABLE "public"."AcademicPositionCommentVote"
  RENAME CONSTRAINT "JobVacancyCommentVote_pkey" TO "AcademicPositionCommentVote_pkey";
ALTER TABLE "public"."AcademicPositionVote"
  RENAME CONSTRAINT "JobVacancyVote_pkey" TO "AcademicPositionVote_pkey";

ALTER TABLE "public"."AcademicPosition"
  RENAME CONSTRAINT "JobVacancy_authorId_fkey" TO "AcademicPosition_authorId_fkey";
ALTER TABLE "public"."AcademicPositionBookmark"
  RENAME CONSTRAINT "JobVacancyBookmark_jobVacancyId_fkey" TO "AcademicPositionBookmark_academicPositionId_fkey";
ALTER TABLE "public"."AcademicPositionBookmark"
  RENAME CONSTRAINT "JobVacancyBookmark_userId_fkey" TO "AcademicPositionBookmark_userId_fkey";
ALTER TABLE "public"."AcademicPositionComment"
  RENAME CONSTRAINT "JobVacancyComment_authorId_fkey" TO "AcademicPositionComment_authorId_fkey";
ALTER TABLE "public"."AcademicPositionComment"
  RENAME CONSTRAINT "JobVacancyComment_jobVacancyId_fkey" TO "AcademicPositionComment_academicPositionId_fkey";
ALTER TABLE "public"."AcademicPositionComment"
  RENAME CONSTRAINT "JobVacancyComment_parentId_fkey" TO "AcademicPositionComment_parentId_fkey";
ALTER TABLE "public"."AcademicPositionCommentVote"
  RENAME CONSTRAINT "JobVacancyCommentVote_commentId_fkey" TO "AcademicPositionCommentVote_commentId_fkey";
ALTER TABLE "public"."AcademicPositionCommentVote"
  RENAME CONSTRAINT "JobVacancyCommentVote_userId_fkey" TO "AcademicPositionCommentVote_userId_fkey";
ALTER TABLE "public"."AcademicPositionVote"
  RENAME CONSTRAINT "JobVacancyVote_jobVacancyId_fkey" TO "AcademicPositionVote_academicPositionId_fkey";
ALTER TABLE "public"."AcademicPositionVote"
  RENAME CONSTRAINT "JobVacancyVote_userId_fkey" TO "AcademicPositionVote_userId_fkey";
