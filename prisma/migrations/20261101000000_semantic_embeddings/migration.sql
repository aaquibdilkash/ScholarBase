-- Async semantic embeddings for recommendations (not search).
--
-- Every content module gets a 384-dimensional MiniLM vector, one column per
-- table, so a detail page can fetch its same-type "related" list with a single
-- HNSW query:
--
--   SCHOLAR         -> "User"           (name, handle, bio, interests)
--   SOCIAL_POST     -> "SocialPost"     (content)
--   PUBLICATION     -> "Publication"    (title, authors, keywords, domain,
--                                        journalOrConference, abstract)
--   ARTICLE         -> "Article"        (title, excerpt, content)
--   HELP_POST       -> "HelpPost"       (title, subject, category, message)
--   CONTRIBUTION    -> "Contribution"   (title, message)
--   RESEARCH_TOOL   -> "ResearchTool"   (name, use, description)
--   RESEARCH_GRANT  -> "ResearchGrant"  (title, description)
--   COURSE          -> "Course"         (title, provider, instructor, format,
--                                        level, description)
--   JOURNAL         -> "Journal"        (title, publisher, about, subjectArea)
--   RESULT          -> "Result"         (title, description, category,
--                                        conductingBody, session)
--   RESEARCH_SURVEY -> "ResearchSurvey" (title, description)
--   RESEARCH_EVENT  -> "ResearchEvent"  (title, location, description)
--   PHD_ADMISSION   -> "PhdAdmission"   (university, department, description)
--   JOB_VACANCY     -> "JobVacancy"     (title, institution, department,
--                                        subject, description)
--   SUPERVISOR      -> "Supervisor"     (name, university, department, about)
--   RECOMMENDATION  -> "Recommendation" (feedback + parent supervisor text)
--   JOURNAL_REVIEW  -> "JournalReview"  (feedback + parent journal text)
--
-- Writes never wait for the model. A BEFORE trigger only maintains a durable
-- outbox row in "EmbeddingJob"; the cron worker in
-- `src/app/api/cron/embed-content` claims rows, batches the ONNX call, and
-- writes the vector back with raw SQL. The migration deliberately does NOT
-- backfill existing rows: enqueue them with
-- `scripts/backfill-semantic-embeddings.sql` after deploy, one entity at a
-- time, so the 2 OCPU box is not saturated during the migration itself.
--
-- pgvector must be available in the Postgres image. Preflight and operations
-- are documented in `docs/semantic-embeddings.md`.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- ---------------------------------------------------------------------------
-- Embedding columns. Unsupported by Prisma Client, so reads and writes go
-- through `$queryRaw`/`$executeRaw` in the semantic worker.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."User"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."SocialPost"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."Publication"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."Article"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."HelpPost"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."Contribution"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."ResearchTool"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."ResearchGrant"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."Course"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."Journal"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."Result"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."ResearchSurvey"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."ResearchEvent"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."PhdAdmission"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."JobVacancy"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."Supervisor"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."Recommendation"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);

ALTER TABLE "public"."JournalReview"
    ADD COLUMN IF NOT EXISTS "embedding" vector(384);
-- ---------------------------------------------------------------------------
-- HNSW cosine indexes. Every existing row starts with a NULL vector, so these
-- build instantly. Running the backfill after the index exists means each
-- batch pays a small incremental insert cost instead of one long blocking
-- index build on a live box.
--
-- Partial predicate: the worker clears soft-deleted rows to NULL, so the index
-- only contains live, embedded rows. Queries filter embedding IS NOT NULL with
-- the same predicate, which lets the planner use the partial index.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "User_embedding_hnsw_idx"
    ON "public"."User" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "SocialPost_embedding_hnsw_idx"
    ON "public"."SocialPost" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Publication_embedding_hnsw_idx"
    ON "public"."Publication" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Article_embedding_hnsw_idx"
    ON "public"."Article" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "HelpPost_embedding_hnsw_idx"
    ON "public"."HelpPost" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Contribution_embedding_hnsw_idx"
    ON "public"."Contribution" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "ResearchTool_embedding_hnsw_idx"
    ON "public"."ResearchTool" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "ResearchGrant_embedding_hnsw_idx"
    ON "public"."ResearchGrant" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Course_embedding_hnsw_idx"
    ON "public"."Course" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Journal_embedding_hnsw_idx"
    ON "public"."Journal" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Result_embedding_hnsw_idx"
    ON "public"."Result" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "ResearchSurvey_embedding_hnsw_idx"
    ON "public"."ResearchSurvey" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "ResearchEvent_embedding_hnsw_idx"
    ON "public"."ResearchEvent" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "PhdAdmission_embedding_hnsw_idx"
    ON "public"."PhdAdmission" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "JobVacancy_embedding_hnsw_idx"
    ON "public"."JobVacancy" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Supervisor_embedding_hnsw_idx"
    ON "public"."Supervisor" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Recommendation_embedding_hnsw_idx"
    ON "public"."Recommendation" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "JournalReview_embedding_hnsw_idx"
    ON "public"."JournalReview" USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
    WHERE "embedding" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Outbox. One row per entity thanks to the unique key; repeated edits coalesce
-- into the same job. `version` is bumped on every enqueue so a worker that
-- started embedding older text cannot delete (or win against) the newer job.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    CREATE TYPE "public"."EmbeddingEntityType" AS ENUM (
        'SCHOLAR',
        'SOCIAL_POST',
        'PUBLICATION',
        'ARTICLE',
        'HELP_POST',
        'CONTRIBUTION',
        'RESEARCH_TOOL',
        'RESEARCH_GRANT',
        'COURSE',
        'JOURNAL',
        'RESULT',
        'RESEARCH_SURVEY',
        'RESEARCH_EVENT',
        'PHD_ADMISSION',
        'JOB_VACANCY',
        'SUPERVISOR',
        'RECOMMENDATION',
        'JOURNAL_REVIEW'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "public"."EmbeddingJob" (
    "id" TEXT NOT NULL,
    "entityType" "public"."EmbeddingEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmbeddingJob_entityType_entityId_key"
    ON "public"."EmbeddingJob" ("entityType", "entityId");

-- Claim order. The worker selects due jobs with FOR UPDATE SKIP LOCKED.
CREATE INDEX IF NOT EXISTS "EmbeddingJob_runAt_createdAt_idx"
    ON "public"."EmbeddingJob" ("runAt", "createdAt");

-- ---------------------------------------------------------------------------
-- Enqueue trigger.
--
-- Attached to content columns only, never to "updatedAt": counter updates bump
-- updatedAt on every vote and would otherwise re-embed the row on every vote.
--
-- Soft delete:
--   * clears NEW."embedding" so the row leaves the partial HNSW index at once
--   * deletes any queued job, since there is nothing left to embed
-- Account recovery flips isDeleted back to false, which re-enqueues the row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."enqueue_embedding_job"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_entity_type "public"."EmbeddingEntityType";
    v_text TEXT;
BEGIN
    CASE TG_TABLE_NAME
        WHEN 'User' THEN
            v_entity_type := 'SCHOLAR';
            v_text := concat_ws(
                ' ',
                NEW."name",
                NEW."handle",
                NEW."bio",
                NEW."interests"
            );
        WHEN 'SocialPost' THEN
            v_entity_type := 'SOCIAL_POST';
            v_text := concat_ws(
                ' ',
                NEW."content"
            );
        WHEN 'Publication' THEN
            v_entity_type := 'PUBLICATION';
            v_text := concat_ws(
                ' ',
                NEW."title",
                NEW."authors",
                NEW."keywords",
                NEW."domain",
                NEW."journalOrConference",
                NEW."abstract"
            );
        WHEN 'Article' THEN
            v_entity_type := 'ARTICLE';
            v_text := concat_ws(
                ' ',
                NEW."title",
                NEW."excerpt",
                NEW."content"
            );
        WHEN 'HelpPost' THEN
            v_entity_type := 'HELP_POST';
            v_text := concat_ws(
                ' ',
                NEW."title",
                NEW."subject",
                NEW."category",
                NEW."message"
            );
        WHEN 'Contribution' THEN
            v_entity_type := 'CONTRIBUTION';
            v_text := concat_ws(
                ' ',
                NEW."title",
                NEW."message"
            );
        WHEN 'ResearchTool' THEN
            v_entity_type := 'RESEARCH_TOOL';
            v_text := concat_ws(
                ' ',
                NEW."name",
                NEW."use",
                NEW."description"
            );
        WHEN 'ResearchGrant' THEN
            v_entity_type := 'RESEARCH_GRANT';
            v_text := concat_ws(
                ' ',
                NEW."title",
                NEW."description"
            );
        WHEN 'Course' THEN
            v_entity_type := 'COURSE';
            v_text := concat_ws(
                ' ',
                NEW."title",
                NEW."provider",
                NEW."instructor",
                NEW."format",
                NEW."level",
                NEW."description"
            );
        WHEN 'Journal' THEN
            v_entity_type := 'JOURNAL';
            v_text := concat_ws(
                ' ',
                NEW."title",
                NEW."publisher",
                NEW."about",
                NEW."subjectArea"
            );
        WHEN 'Result' THEN
            v_entity_type := 'RESULT';
            v_text := concat_ws(
                ' ',
                NEW."title",
                NEW."description",
                NEW."category",
                NEW."conductingBody",
                NEW."session"
            );
        WHEN 'ResearchSurvey' THEN
            v_entity_type := 'RESEARCH_SURVEY';
            v_text := concat_ws(
                ' ',
                NEW."title",
                NEW."description"
            );
        WHEN 'ResearchEvent' THEN
            v_entity_type := 'RESEARCH_EVENT';
            v_text := concat_ws(
                ' ',
                NEW."title",
                NEW."location",
                NEW."description"
            );
        WHEN 'PhdAdmission' THEN
            v_entity_type := 'PHD_ADMISSION';
            v_text := concat_ws(
                ' ',
                NEW."university",
                NEW."department",
                NEW."description"
            );
        WHEN 'JobVacancy' THEN
            v_entity_type := 'JOB_VACANCY';
            v_text := concat_ws(
                ' ',
                NEW."title",
                NEW."institution",
                NEW."department",
                NEW."subject",
                NEW."description"
            );
        WHEN 'Supervisor' THEN
            v_entity_type := 'SUPERVISOR';
            v_text := concat_ws(
                ' ',
                NEW."name",
                NEW."university",
                NEW."department",
                NEW."about"
            );
        WHEN 'Recommendation' THEN
            v_entity_type := 'RECOMMENDATION';
            v_text := concat_ws(
                ' ',
                NEW."feedback"
            );
        WHEN 'JournalReview' THEN
            v_entity_type := 'JOURNAL_REVIEW';
            v_text := concat_ws(
                ' ',
                NEW."feedback"
            );
        ELSE
            RAISE EXCEPTION
                'enqueue_embedding_job() does not handle table %',
                TG_TABLE_NAME;
    END CASE;

    IF NEW."isDeleted" THEN
        NEW."embedding" := NULL;

        DELETE FROM "public"."EmbeddingJob"
        WHERE "entityType" = v_entity_type
          AND "entityId" = NEW."id";

        RETURN NEW;
    END IF;

    IF v_text IS NULL OR btrim(v_text) = '' THEN
        NEW."embedding" := NULL;

        DELETE FROM "public"."EmbeddingJob"
        WHERE "entityType" = v_entity_type
          AND "entityId" = NEW."id";

        RETURN NEW;
    END IF;

    INSERT INTO "public"."EmbeddingJob" AS job (
        "id",
        "entityType",
        "entityId",
        "createdAt",
        "updatedAt"
    )
    VALUES (
        gen_random_uuid()::text,
        v_entity_type,
        NEW."id",
        now(),
        now()
    )
    ON CONFLICT ("entityType", "entityId") DO UPDATE SET
        "runAt" = now(),
        "attempts" = 0,
        "lastError" = NULL,
        "version" = job."version" + 1,
        "updatedAt" = now();

    RETURN NEW;
END;
$$;

-- Work columns are the same free-text columns the embedding text builders in
-- `src/lib/semantic/text.ts` read. Add a column in both places or the job will
-- silently miss edits. Recommendation and JournalReview watch only `feedback`:
-- the worker adds parent (supervisor/journal) context at embed time, so a
-- parent rename does not re-enqueue every child review.
CREATE TRIGGER "User_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "name", "handle", "bio", "interests", "isDeleted"
ON "public"."User"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "SocialPost_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "content", "isDeleted"
ON "public"."SocialPost"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "Publication_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF
    "title",
    "authors",
    "keywords",
    "domain",
    "journalOrConference",
    "abstract",
    "isDeleted"
ON "public"."Publication"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "Article_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "title", "excerpt", "content", "isDeleted"
ON "public"."Article"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "HelpPost_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "title", "subject", "category", "message", "isDeleted"
ON "public"."HelpPost"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "Contribution_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "title", "message", "isDeleted"
ON "public"."Contribution"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "ResearchTool_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "name", "use", "description", "isDeleted"
ON "public"."ResearchTool"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "ResearchGrant_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "title", "description", "isDeleted"
ON "public"."ResearchGrant"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "Course_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF
    "title",
    "provider",
    "instructor",
    "format",
    "level",
    "description",
    "isDeleted"
ON "public"."Course"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "Journal_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "title", "publisher", "about", "subjectArea", "isDeleted"
ON "public"."Journal"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "Result_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF
    "title",
    "description",
    "category",
    "conductingBody",
    "session",
    "isDeleted"
ON "public"."Result"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "ResearchSurvey_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "title", "description", "isDeleted"
ON "public"."ResearchSurvey"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "ResearchEvent_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "title", "location", "description", "isDeleted"
ON "public"."ResearchEvent"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "PhdAdmission_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "university", "department", "description", "isDeleted"
ON "public"."PhdAdmission"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "JobVacancy_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF
    "title",
    "institution",
    "department",
    "subject",
    "description",
    "isDeleted"
ON "public"."JobVacancy"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "Supervisor_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "name", "university", "department", "about", "isDeleted"
ON "public"."Supervisor"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "Recommendation_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "feedback", "isDeleted"
ON "public"."Recommendation"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();

CREATE TRIGGER "JournalReview_embedding_enqueue_trg"
BEFORE INSERT OR UPDATE OF "feedback", "isDeleted"
ON "public"."JournalReview"
FOR EACH ROW
EXECUTE FUNCTION "public"."enqueue_embedding_job"();
