-- Generalize the PhD-only admission module to admissions at any degree level.
-- Existing rows are backfilled to `PHD` by the column default, so no data is
-- reinterpreted: every pre-migration admission really was a PhD admission.

CREATE TYPE "AdmissionLevel" AS ENUM ('PHD', 'MASTERS', 'UNDERGRADUATE', 'MPHIL', 'OTHER');

ALTER TYPE "EmbeddingEntityType" RENAME VALUE 'PHD_ADMISSION' TO 'ADMISSION';

ALTER TABLE "public"."PhdAdmission" RENAME TO "Admission";
ALTER TABLE "public"."PhdAdmissionBookmark" RENAME TO "AdmissionBookmark";
ALTER TABLE "public"."PhdAdmissionComment" RENAME TO "AdmissionComment";
ALTER TABLE "public"."PhdAdmissionCommentVote" RENAME TO "AdmissionCommentVote";
ALTER TABLE "public"."PhdAdmissionVote" RENAME TO "AdmissionVote";

ALTER TABLE "public"."AdmissionBookmark"
  RENAME COLUMN "phdAdmissionId" TO "admissionId";
ALTER TABLE "public"."AdmissionComment"
  RENAME COLUMN "phdAdmissionId" TO "admissionId";
ALTER TABLE "public"."AdmissionVote"
  RENAME COLUMN "phdAdmissionId" TO "admissionId";
ALTER TABLE "public"."User"
  RENAME COLUMN "phdAdmissionCount" TO "admissionCount";

ALTER TABLE "public"."Admission"
  ADD COLUMN "level" "AdmissionLevel" NOT NULL DEFAULT 'PHD';

-- Activity rows store the module key verbatim; rewrite the old spelling so the
-- activity feed and hide/restore helpers keep matching existing rows.
UPDATE "public"."UserActivity"
SET "moduleType" = 'ADMISSION'
WHERE "moduleType" = 'PHD_ADMISSION';

UPDATE "public"."UserActivity"
SET "moduleType" = 'ADMISSION_COMMENT'
WHERE "moduleType" = 'PHD_ADMISSION_COMMENT';

UPDATE "public"."Report"
SET "module" = 'ADMISSION'
WHERE "module" = 'PHD_ADMISSION';

UPDATE "public"."Report"
SET "module" = 'ADMISSION_COMMENT'
WHERE "module" = 'PHD_ADMISSION_COMMENT';

UPDATE "public"."Appeal"
SET "module" = 'ADMISSION'
WHERE "module" = 'PHD_ADMISSION';

UPDATE "public"."Appeal"
SET "module" = 'ADMISSION_COMMENT'
WHERE "module" = 'PHD_ADMISSION_COMMENT';

-- Rewrite the outbox trigger's table name and entity enum, and include the new
-- degree level in the embedded text. The function body is read back rather than
-- duplicated so every other module keeps its current definition.
DO $$
DECLARE
  function_definition TEXT;
BEGIN
  SELECT pg_get_functiondef('public.enqueue_embedding_job()'::regprocedure)
    INTO function_definition;
  function_definition := replace(
    replace(function_definition, 'PhdAdmission', 'Admission'),
    'PHD_ADMISSION',
    'ADMISSION'
  );
  function_definition := replace(
    function_definition,
    E'                NEW."university",\n                NEW."department",\n                NEW."description"',
    E'                NEW."university",\n                NEW."department",\n                NEW."level",\n                NEW."description"'
  );
  EXECUTE function_definition;
END $$;

DROP TRIGGER IF EXISTS "PhdAdmission_embedding_enqueue_trg" ON "public"."Admission";
CREATE TRIGGER "Admission_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "university", "department", "level", "description", "isDeleted"
ON "public"."Admission"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

ALTER INDEX IF EXISTS "PhdAdmission_authorId_createdAt_idx"
  RENAME TO "Admission_authorId_createdAt_idx";
ALTER INDEX IF EXISTS "PhdAdmission_createdAt_idx"
  RENAME TO "Admission_createdAt_idx";
ALTER INDEX IF EXISTS "PhdAdmission_trendingScore_idx"
  RENAME TO "Admission_trendingScore_idx";
ALTER INDEX IF EXISTS "PhdAdmissionBookmark_phdAdmissionId_userId_key"
  RENAME TO "AdmissionBookmark_admissionId_userId_key";
ALTER INDEX IF EXISTS "PhdAdmissionBookmark_userId_createdAt_idx"
  RENAME TO "AdmissionBookmark_userId_createdAt_idx";
ALTER INDEX IF EXISTS "PhdAdmissionComment_phdAdmissionId_createdAt_idx"
  RENAME TO "AdmissionComment_admissionId_createdAt_idx";
ALTER INDEX IF EXISTS "PhdAdmissionCommentVote_commentId_userId_key"
  RENAME TO "AdmissionCommentVote_commentId_userId_key";
ALTER INDEX IF EXISTS "PhdAdmissionVote_phdAdmissionId_userId_key"
  RENAME TO "AdmissionVote_admissionId_userId_key";
ALTER INDEX IF EXISTS "PhdAdmission_university_trgm_idx"
  RENAME TO "Admission_university_trgm_idx";
ALTER INDEX IF EXISTS "PhdAdmission_department_trgm_idx"
  RENAME TO "Admission_department_trgm_idx";
ALTER INDEX IF EXISTS "PhdAdmission_description_trgm_idx"
  RENAME TO "Admission_description_trgm_idx";
ALTER INDEX IF EXISTS "PhdAdmission_embedding_hnsw_idx"
  RENAME TO "Admission_embedding_hnsw_idx";
CREATE INDEX IF NOT EXISTS "Admission_university_trgm_idx"
  ON "public"."Admission" USING gin ("university" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Admission_department_trgm_idx"
  ON "public"."Admission" USING gin ("department" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Admission_description_trgm_idx"
  ON "public"."Admission" USING gin ("description" gin_trgm_ops);

ALTER TABLE "public"."Admission"
  RENAME CONSTRAINT "PhdAdmission_pkey" TO "Admission_pkey";
ALTER TABLE "public"."AdmissionBookmark"
  RENAME CONSTRAINT "PhdAdmissionBookmark_pkey" TO "AdmissionBookmark_pkey";
ALTER TABLE "public"."AdmissionComment"
  RENAME CONSTRAINT "PhdAdmissionComment_pkey" TO "AdmissionComment_pkey";
ALTER TABLE "public"."AdmissionCommentVote"
  RENAME CONSTRAINT "PhdAdmissionCommentVote_pkey" TO "AdmissionCommentVote_pkey";
ALTER TABLE "public"."AdmissionVote"
  RENAME CONSTRAINT "PhdAdmissionVote_pkey" TO "AdmissionVote_pkey";

ALTER TABLE "public"."Admission"
  RENAME CONSTRAINT "PhdAdmission_authorId_fkey" TO "Admission_authorId_fkey";
ALTER TABLE "public"."AdmissionBookmark"
  RENAME CONSTRAINT "PhdAdmissionBookmark_phdAdmissionId_fkey" TO "AdmissionBookmark_admissionId_fkey";
ALTER TABLE "public"."AdmissionBookmark"
  RENAME CONSTRAINT "PhdAdmissionBookmark_userId_fkey" TO "AdmissionBookmark_userId_fkey";
ALTER TABLE "public"."AdmissionComment"
  RENAME CONSTRAINT "PhdAdmissionComment_authorId_fkey" TO "AdmissionComment_authorId_fkey";
ALTER TABLE "public"."AdmissionComment"
  RENAME CONSTRAINT "PhdAdmissionComment_parentId_fkey" TO "AdmissionComment_parentId_fkey";
ALTER TABLE "public"."AdmissionComment"
  RENAME CONSTRAINT "PhdAdmissionComment_phdAdmissionId_fkey" TO "AdmissionComment_admissionId_fkey";
ALTER TABLE "public"."AdmissionCommentVote"
  RENAME CONSTRAINT "PhdAdmissionCommentVote_commentId_fkey" TO "AdmissionCommentVote_commentId_fkey";
ALTER TABLE "public"."AdmissionCommentVote"
  RENAME CONSTRAINT "PhdAdmissionCommentVote_userId_fkey" TO "AdmissionCommentVote_userId_fkey";
ALTER TABLE "public"."AdmissionVote"
  RENAME CONSTRAINT "PhdAdmissionVote_phdAdmissionId_fkey" TO "AdmissionVote_admissionId_fkey";
ALTER TABLE "public"."AdmissionVote"
  RENAME CONSTRAINT "PhdAdmissionVote_userId_fkey" TO "AdmissionVote_userId_fkey";
