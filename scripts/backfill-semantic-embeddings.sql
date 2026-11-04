-- Enqueue existing rows for the async embedding worker.
--
-- Run after `prisma migrate deploy` has created the vector columns, HNSW
-- indexes and EmbeddingJob table. Run one block at a time during a low-traffic
-- window; the worker drains the queue at its own pace, so this script only
-- inserts lightweight job rows.
--
-- The `embedding IS NULL` filter makes the script safe to re-run: rows that
-- already have a vector are not queued again. To rebuild every vector (for
-- example after changing the text projection), first clear the column:
--
--   UPDATE "User" SET "embedding" = NULL;
--   -- repeat for each table below, then run this file again.
--
-- Recommendation and JournalReview only enqueue on `feedback`. The worker adds
-- the parent supervisor/journal text when it embeds, so no join is needed here.

\echo 'Enqueuing scholars (User)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'SCHOLAR',
    scholar."id",
    now(),
    now()
FROM "public"."User" AS scholar
WHERE scholar."isDeleted" = false
  AND scholar."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      scholar."name",
      scholar."handle",
      scholar."bio",
      scholar."interests"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing social posts (SocialPost)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'SOCIAL_POST',
    post."id",
    now(),
    now()
FROM "public"."SocialPost" AS post
WHERE post."isDeleted" = false
  AND post."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      post."content"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing publications (Publication)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'PUBLICATION',
    publication."id",
    now(),
    now()
FROM "public"."Publication" AS publication
WHERE publication."isDeleted" = false
  AND publication."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      publication."title",
      publication."authors",
      publication."keywords",
      publication."domain",
      publication."journalOrConference",
      publication."abstract"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing articles (Article)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'ARTICLE',
    article."id",
    now(),
    now()
FROM "public"."Article" AS article
WHERE article."isDeleted" = false
  AND article."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      article."title",
      article."excerpt",
      article."content"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing help posts (HelpPost)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'HELP_POST',
    post."id",
    now(),
    now()
FROM "public"."HelpPost" AS post
WHERE post."isDeleted" = false
  AND post."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      post."title",
      post."subject",
      post."category",
      post."message"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing contributions (Contribution)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'CONTRIBUTION',
    contribution."id",
    now(),
    now()
FROM "public"."Contribution" AS contribution
WHERE contribution."isDeleted" = false
  AND contribution."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      contribution."title",
      contribution."message"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing research tools (ResearchTool)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'RESEARCH_TOOL',
    tool."id",
    now(),
    now()
FROM "public"."ResearchTool" AS tool
WHERE tool."isDeleted" = false
  AND tool."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      tool."name",
      tool."use",
      tool."description"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing research grants (ResearchGrant)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'RESEARCH_GRANT',
    grant_row."id",
    now(),
    now()
FROM "public"."ResearchGrant" AS grant_row
WHERE grant_row."isDeleted" = false
  AND grant_row."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      grant_row."title",
      grant_row."description"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing courses (Course)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'COURSE',
    course."id",
    now(),
    now()
FROM "public"."Course" AS course
WHERE course."isDeleted" = false
  AND course."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      course."title",
      course."provider",
      course."instructor",
      course."format",
      course."level",
      course."description"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing journals (Journal)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'JOURNAL',
    journal."id",
    now(),
    now()
FROM "public"."Journal" AS journal
WHERE journal."isDeleted" = false
  AND journal."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      journal."title",
      journal."publisher",
      journal."about",
      journal."subjectArea"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing results (Result)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'RESULT',
    result."id",
    now(),
    now()
FROM "public"."Result" AS result
WHERE result."isDeleted" = false
  AND result."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      result."title",
      result."description",
      result."category",
      result."conductingBody",
      result."session"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing surveys (ResearchSurvey)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'RESEARCH_SURVEY',
    survey."id",
    now(),
    now()
FROM "public"."ResearchSurvey" AS survey
WHERE survey."isDeleted" = false
  AND survey."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      survey."title",
      survey."description"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing events (ResearchEvent)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'RESEARCH_EVENT',
    event."id",
    now(),
    now()
FROM "public"."ResearchEvent" AS event
WHERE event."isDeleted" = false
  AND event."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      event."title",
      event."location",
      event."description"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing PhD admissions (PhdAdmission)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'PHD_ADMISSION',
    admission."id",
    now(),
    now()
FROM "public"."PhdAdmission" AS admission
WHERE admission."isDeleted" = false
  AND admission."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      admission."university",
      admission."department",
      admission."description"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing vacancies (JobVacancy)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'JOB_VACANCY',
    vacancy."id",
    now(),
    now()
FROM "public"."JobVacancy" AS vacancy
WHERE vacancy."isDeleted" = false
  AND vacancy."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      vacancy."title",
      vacancy."institution",
      vacancy."department",
      vacancy."subject",
      vacancy."description"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing supervisors (Supervisor)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'SUPERVISOR',
    supervisor."id",
    now(),
    now()
FROM "public"."Supervisor" AS supervisor
WHERE supervisor."isDeleted" = false
  AND supervisor."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      supervisor."name",
      supervisor."university",
      supervisor."department",
      supervisor."about"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing recommendations (Recommendation)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'RECOMMENDATION',
    recommendation."id",
    now(),
    now()
FROM "public"."Recommendation" AS recommendation
WHERE recommendation."isDeleted" = false
  AND recommendation."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      recommendation."feedback"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Enqueuing journal reviews (JournalReview)'
INSERT INTO "public"."EmbeddingJob" (
    "id",
    "entityType",
    "entityId",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'JOURNAL_REVIEW',
    review."id",
    now(),
    now()
FROM "public"."JournalReview" AS review
WHERE review."isDeleted" = false
  AND review."embedding" IS NULL
  AND btrim(concat_ws(
      ' ',
      review."feedback"
  )) <> ''
ON CONFLICT ("entityType", "entityId") DO NOTHING;

\echo 'Done. Check the queue with: SELECT "entityType", count(*) FROM "EmbeddingJob" GROUP BY 1;'
