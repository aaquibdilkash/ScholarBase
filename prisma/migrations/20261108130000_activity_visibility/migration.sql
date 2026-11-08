-- Activity visibility + route metadata.
--
-- UserActivity rows are the profile's activity feed. They used to be deleted
-- outright by the survey/vacancy delete paths (and left untouched everywhere
-- else), so author-deleted content either lingered in the feed or vanished
-- forever when an admin recovered it. Both are wrong.
--
-- Visibility is now two independent flags:
--   hiddenByContent -> the parent content row is soft-deleted
--   hiddenByComment -> the comment/reply the row describes is soft-deleted
-- A row is visible only while both are false. Recovery clears the matching
-- flag, which is why recovering content cannot resurrect an independently
-- deleted comment (and vice versa).
--
-- parentEntityId/entityChildId also give comment and comment-vote activity a
-- route-ready link target instead of a bare comment id with no page.

ALTER TABLE "UserActivity"
    ADD COLUMN "parentEntityId" TEXT,
    ADD COLUMN "entityChildId" TEXT,
    ADD COLUMN "hiddenByContent" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "hiddenByComment" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "UserActivity_userId_hiddenByContent_hiddenByComment_createdAt_idx"
    ON "UserActivity"("userId", "hiddenByContent", "hiddenByComment", "createdAt" DESC);
CREATE INDEX "UserActivity_parentEntityId_idx" ON "UserActivity"("parentEntityId");
CREATE INDEX "UserActivity_entityChildId_idx" ON "UserActivity"("entityChildId");

-- ---------------------------------------------------------------------------
-- Backfill: COMMENTED / REPLIED rows point at the content they were posted on.
-- ---------------------------------------------------------------------------
UPDATE "UserActivity"
SET "parentEntityId" = "entityId"
WHERE "action" IN ('COMMENTED', 'REPLIED')
  AND "parentEntityId" IS NULL;

-- Nested resources store a bare id in entityId; their route is
-- /supervisor/[supervisorId]/recommendation/[id] and
-- /journals/[journalId]/review/[id].
UPDATE "UserActivity" ua
SET "parentEntityId" = r."supervisorId" || '/' || ua."entityId"
FROM "Recommendation" r
WHERE ua."moduleType" = 'RECOMMENDATION'
  AND ua."action" IN ('COMMENTED', 'REPLIED')
  AND ua."entityId" = r."id";

UPDATE "UserActivity" ua
SET "parentEntityId" = jr."journalId" || '/' || ua."entityId"
FROM "JournalReview" jr
WHERE ua."moduleType" = 'JOURNAL_REVIEW'
  AND ua."action" IN ('COMMENTED', 'REPLIED')
  AND ua."entityId" = jr."id";

-- ---------------------------------------------------------------------------
-- Backfill: VOTED rows whose moduleType ends in _COMMENT store the comment id.
-- ---------------------------------------------------------------------------
UPDATE "UserActivity"
SET "entityChildId" = "entityId"
WHERE "action" = 'VOTED'
  AND right("moduleType", 8) = '_COMMENT'
  AND "entityChildId" IS NULL;

DO $$
DECLARE
  m RECORD;
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      ('SOCIAL_POST_COMMENT', 'SocialComment', 'socialPostId'),
      ('ARTICLE_COMMENT', 'ArticleComment', 'articleId'),
      ('HELP_POST_COMMENT', 'HelpPostComment', 'helpPostId'),
      ('CONTRIBUTION_COMMENT', 'ContributionComment', 'contributionId'),
      ('PUBLICATION_COMMENT', 'PublicationComment', 'publicationId'),
      ('RESEARCH_TOOL_COMMENT', 'ResearchToolComment', 'researchToolId'),
      ('RESEARCH_GRANT_COMMENT', 'ResearchGrantComment', 'researchGrantId'),
      ('COURSE_COMMENT', 'CourseComment', 'courseId'),
      ('JOURNAL_COMMENT', 'JournalComment', 'journalId'),
      ('RESULT_COMMENT', 'ResultComment', 'resultId'),
      ('RESEARCH_SURVEY_COMMENT', 'SurveyComment', 'surveyId'),
      ('RESEARCH_EVENT_COMMENT', 'ResearchEventComment', 'researchEventId'),
      ('PHD_ADMISSION_COMMENT', 'PhdAdmissionComment', 'phdAdmissionId'),
      ('JOB_VACANCY_COMMENT', 'JobVacancyComment', 'jobVacancyId'),
      ('SUPERVISOR_COMMENT', 'SupervisorComment', 'supervisorId'),
      ('RECOMMENDATION_COMMENT', 'RecommendationComment', 'recommendationId'),
      ('JOURNAL_REVIEW_COMMENT', 'JournalReviewComment', 'journalReviewId')
    ) AS t(module, tbl, fk)
  LOOP
    EXECUTE format(
      'UPDATE "UserActivity" ua SET "parentEntityId" = c.%I FROM %I c WHERE ua."moduleType" = %L AND ua."action" = ''VOTED'' AND ua."entityId" = c."id"',
      m.fk, m.tbl, m.module
    );
  END LOOP;
END $$;

-- Comment votes on nested resources need the parent's parent in the route.
UPDATE "UserActivity" ua
SET "parentEntityId" = r."supervisorId" || '/' || rc."recommendationId"
FROM "RecommendationComment" rc
JOIN "Recommendation" r ON r."id" = rc."recommendationId"
WHERE ua."moduleType" = 'RECOMMENDATION_COMMENT'
  AND ua."action" = 'VOTED'
  AND ua."entityId" = rc."id";

UPDATE "UserActivity" ua
SET "parentEntityId" = jr."journalId" || '/' || jrc."journalReviewId"
FROM "JournalReviewComment" jrc
JOIN "JournalReview" jr ON jr."id" = jrc."journalReviewId"
WHERE ua."moduleType" = 'JOURNAL_REVIEW_COMMENT'
  AND ua."action" = 'VOTED'
  AND ua."entityId" = jrc."id";

-- ---------------------------------------------------------------------------
-- Backfill visible state: hide activity whose content/comment is already
-- soft-deleted, so existing deleted rows stop appearing immediately.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  m RECORD;
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      ('SOCIAL_POST', 'SocialPost'),
      ('ARTICLE', 'Article'),
      ('HELP_POST', 'HelpPost'),
      ('CONTRIBUTION', 'Contribution'),
      ('PUBLICATION', 'Publication'),
      ('RESEARCH_TOOL', 'ResearchTool'),
      ('RESEARCH_GRANT', 'ResearchGrant'),
      ('COURSE', 'Course'),
      ('JOURNAL', 'Journal'),
      ('RESULT', 'Result'),
      ('RESEARCH_SURVEY', 'ResearchSurvey'),
      ('RESEARCH_EVENT', 'ResearchEvent'),
      ('PHD_ADMISSION', 'PhdAdmission'),
      ('JOB_VACANCY', 'JobVacancy'),
      ('SUPERVISOR', 'Supervisor')
    ) AS t(module, tbl)
  LOOP
    EXECUTE format(
      'UPDATE "UserActivity" SET "hiddenByContent" = true WHERE "moduleType" = %L AND "entityId" IN (SELECT "id" FROM %I WHERE "isDeleted" = true) OR "parentEntityId" IN (SELECT "id" FROM %I WHERE "isDeleted" = true)',
      m.module, m.tbl, m.tbl
    );
  END LOOP;
END $$;

UPDATE "UserActivity"
SET "hiddenByContent" = true
WHERE "entityId" IN (
        SELECT "supervisorId" || '/' || "id" FROM "Recommendation" WHERE "isDeleted" = true
      )
   OR "parentEntityId" IN (
        SELECT "supervisorId" || '/' || "id" FROM "Recommendation" WHERE "isDeleted" = true
      );

UPDATE "UserActivity"
SET "hiddenByContent" = true
WHERE "entityId" IN (
        SELECT "journalId" || '/' || "id" FROM "JournalReview" WHERE "isDeleted" = true
      )
   OR "parentEntityId" IN (
        SELECT "journalId" || '/' || "id" FROM "JournalReview" WHERE "isDeleted" = true
      );

DO $$
DECLARE
  m RECORD;
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      ('SOCIAL_POST_COMMENT', 'SOCIAL_POST', 'SocialComment'),
      ('ARTICLE_COMMENT', 'ARTICLE', 'ArticleComment'),
      ('HELP_POST_COMMENT', 'HELP_POST', 'HelpPostComment'),
      ('CONTRIBUTION_COMMENT', 'CONTRIBUTION', 'ContributionComment'),
      ('PUBLICATION_COMMENT', 'PUBLICATION', 'PublicationComment'),
      ('RESEARCH_TOOL_COMMENT', 'RESEARCH_TOOL', 'ResearchToolComment'),
      ('RESEARCH_GRANT_COMMENT', 'RESEARCH_GRANT', 'ResearchGrantComment'),
      ('COURSE_COMMENT', 'COURSE', 'CourseComment'),
      ('JOURNAL_COMMENT', 'JOURNAL', 'JournalComment'),
      ('RESULT_COMMENT', 'RESULT', 'ResultComment'),
      ('RESEARCH_SURVEY_COMMENT', 'RESEARCH_SURVEY', 'SurveyComment'),
      ('RESEARCH_EVENT_COMMENT', 'RESEARCH_EVENT', 'ResearchEventComment'),
      ('PHD_ADMISSION_COMMENT', 'PHD_ADMISSION', 'PhdAdmissionComment'),
      ('JOB_VACANCY_COMMENT', 'JOB_VACANCY', 'JobVacancyComment'),
      ('SUPERVISOR_COMMENT', 'SUPERVISOR', 'SupervisorComment'),
      ('RECOMMENDATION_COMMENT', 'RECOMMENDATION', 'RecommendationComment'),
      ('JOURNAL_REVIEW_COMMENT', 'JOURNAL_REVIEW', 'JournalReviewComment')
    ) AS t(commentModule, contentModule, tbl)
  LOOP
    EXECUTE format(
      'UPDATE "UserActivity" ua SET "hiddenByComment" = true FROM %I c WHERE c."isDeleted" = true AND ua."entityChildId" = c."id"',
      m.tbl
    );

    EXECUTE format(
      'UPDATE "UserActivity" ua SET "hiddenByComment" = true FROM %I c WHERE c."isDeleted" = true AND ua."moduleType" = %L AND ua."action" IN (''COMMENTED'', ''REPLIED'') AND ua."userId" = c."authorId" AND position(''|||'' || regexp_replace(c."content", ''\s+'', '' '', ''g'') in ua."entityTitle") > 0',
      m.tbl, m.contentModule
    );
  END LOOP;
END $$;
