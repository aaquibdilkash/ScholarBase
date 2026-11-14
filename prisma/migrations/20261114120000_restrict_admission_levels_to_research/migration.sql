-- Restrict admissions to research degrees: PhD, MS/MSc by Research, or another
-- research degree. MPhil was discontinued by UGC Regulation 14 of the PhD
-- Regulations 2022 (see also the December 2023 UGC notice), so new MPhil
-- admissions are not accepted.
--
-- Legacy taught-degree rows are remapped in the same pass so no row keeps a
-- value the new enum no longer has:
--   MASTERS       -> MS_BY_RESEARCH
--   UNDERGRADUATE -> OTHER
--   MPHIL         -> OTHER
--
-- The type is recreated instead of appended because PostgreSQL cannot remove
-- enum values. The CASE expression avoids the "unsafe use of new enum value in
-- the same transaction" restriction. `ALTER COLUMN ... TYPE` rewrites the small
-- Admission table and does not fire the embedding enqueue trigger, so remapped
-- rows keep their existing vectors; a follow-up backfill can re-enqueue them if
-- exact related-content text is needed.

-- PostgreSQL refuses `ALTER COLUMN ... TYPE` while a trigger's column list
-- references that column (0A000), and the embedding trigger watches `level`
-- (see 20261111150000_rename_phd_admissions_to_admissions). Drop it for the
-- rewrite and restore the exact same definition afterwards.
DROP TRIGGER IF EXISTS "Admission_embedding_enqueue_trg" ON "public"."Admission";

-- Safety net for a retried run after a failed attempt left the scratch type.
DROP TYPE IF EXISTS "AdmissionLevel_new";

CREATE TYPE "AdmissionLevel_new" AS ENUM ('PHD', 'MS_BY_RESEARCH', 'OTHER');

ALTER TABLE "public"."Admission" ALTER COLUMN "level" DROP DEFAULT;

ALTER TABLE "public"."Admission"
  ALTER COLUMN "level" TYPE "AdmissionLevel_new"
  USING (
    CASE "level"::text
      WHEN 'MASTERS' THEN 'MS_BY_RESEARCH'
      WHEN 'UNDERGRADUATE' THEN 'OTHER'
      WHEN 'MPHIL' THEN 'OTHER'
      ELSE "level"::text
    END
  )::"AdmissionLevel_new";

DROP TYPE "AdmissionLevel";
ALTER TYPE "AdmissionLevel_new" RENAME TO "AdmissionLevel";

ALTER TABLE "public"."Admission" ALTER COLUMN "level" SET DEFAULT 'PHD';

CREATE TRIGGER "Admission_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "university", "department", "level", "description", "isDeleted"
ON "public"."Admission"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();
