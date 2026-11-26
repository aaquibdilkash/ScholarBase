-- Publications become personal showcase entries on the scholar profile.
-- Votes, comments, bookmarks, reports, trending, and freeze state are removed.
-- Reputation already granted by past publication votes is intentionally kept.

-- 1. Remove polymorphic rows that pointed at the dropped publication modules.
DELETE FROM "Report" WHERE "module" IN ('PUBLICATION', 'PUBLICATION_COMMENT');
DELETE FROM "Appeal" WHERE "module" IN ('PUBLICATION', 'PUBLICATION_COMMENT');
DELETE FROM "UserActivity" WHERE "moduleType" IN ('PUBLICATION', 'PUBLICATION_COMMENT');

-- 2. Drop the social child tables (children first so FKs cascade cleanly).
DROP TABLE IF EXISTS "PublicationCommentVote";
DROP TABLE IF EXISTS "PublicationComment";
DROP TABLE IF EXISTS "PublicationBookmark";
DROP TABLE IF EXISTS "PublicationVote";

-- 3. Drop list/trending/search indexes that no longer have a reader.
DROP INDEX IF EXISTS "Publication_trendingScore_idx";
DROP INDEX IF EXISTS "Publication_title_trgm_idx";
DROP INDEX IF EXISTS "Publication_authors_trgm_idx";
DROP INDEX IF EXISTS "Publication_keywords_trgm_idx";
DROP INDEX IF EXISTS "Publication_domain_trgm_idx";
DROP INDEX IF EXISTS "Publication_journalOrConference_trgm_idx";
DROP INDEX IF EXISTS "Publication_abstract_trgm_idx";

-- 4. Drop the social/moderation columns.
ALTER TABLE "Publication"
  DROP COLUMN IF EXISTS "totalVotes",
  DROP COLUMN IF EXISTS "totalBookmarks",
  DROP COLUMN IF EXISTS "totalComments",
  DROP COLUMN IF EXISTS "trendingScore",
  DROP COLUMN IF EXISTS "reportCount",
  DROP COLUMN IF EXISTS "isFrozen",
  DROP COLUMN IF EXISTS "hasActiveAppeal",
  DROP COLUMN IF EXISTS "isUserAuthor";

-- 5. About-tab ordering: year DESC NULLS LAST, then createdAt DESC, id DESC.
CREATE INDEX "Publication_authorId_year_createdAt_idx"
  ON "Publication"("authorId" ASC, "year" DESC, "createdAt" DESC);

-- 6. update_trending_scores() no longer owns the Publication table. This is a
--    manual Supabase function (see src/app/api/cron/update-trending/update-trending.md);
--    keep the two definitions in step.
CREATE OR REPLACE FUNCTION update_trending_scores()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tbl text;
  gravity constant numeric := 1.8;
  failed_tables text[] := '{}';

  -- 1. Ephemeral Content Tables (7-Day Cutoff)
  target_tables text[] := ARRAY[
    'Article',
    'SocialPost',
    'HelpPost',
    'Contribution',
    'ResearchTool',
    'ResearchGrant',
    'Course',
    'ExamsAndResults',
    'CallForPaper',
    'Admission',
    'AcademicPosition',
    'Recommendation',
    'JournalReview'
  ];
BEGIN

  -- =========================================================================
  -- 1. STANDARD CONTENT (7-Day Rolling Window)
  -- =========================================================================
  FOREACH tbl IN ARRAY target_tables
  LOOP
    BEGIN
      -- Step A: Reset stale items (> 7 days old) so old scores don't freeze at the top
      EXECUTE format('
        UPDATE %I
        SET "trendingScore" = 0
        WHERE "trendingScore" > 0
          AND ("createdAt" < NOW() - INTERVAL ''7 days'' OR "isDeleted" = true OR "isFrozen" = true);
      ', tbl);

      -- Step B: Calculate trending for active items in last 7 days
      EXECUTE format('
        UPDATE %I
        SET "trendingScore" = (
          COALESCE("totalVotes", 0) +
          (COALESCE("totalComments", 0) * 1.5) +
          (COALESCE("totalBookmarks", 0) * 1.2)
        ) / POW(EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 3600.0 + 2.0, %s)
        WHERE "createdAt" >= NOW() - INTERVAL ''7 days''
          AND "isDeleted" = false
          AND "isFrozen" = false;
      ', tbl, gravity);

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to update trending score for table %: %', tbl, SQLERRM;
      failed_tables := array_append(failed_tables, tbl);
    END;
  END LOOP;

  -- =========================================================================
  -- 2. RESEARCH SURVEYS (Includes totalResponses)
  -- =========================================================================
  BEGIN
    UPDATE "ResearchSurvey"
    SET "trendingScore" = 0
    WHERE "trendingScore" > 0
      AND ("createdAt" < NOW() - INTERVAL '14 days' OR "isDeleted" = true OR "isFrozen" = true);

    UPDATE "ResearchSurvey"
    SET "trendingScore" = (
      COALESCE("totalVotes", 0) +
      (COALESCE("totalComments", 0) * 1.5) +
      (COALESCE("totalBookmarks", 0) * 1.2) +
      (COALESCE("totalResponses", 0) * 2.0)
    ) / POW(EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 3600.0 + 2.0, gravity)
    WHERE "createdAt" >= NOW() - INTERVAL '14 days'
      AND "isDeleted" = false
      AND "isFrozen" = false;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to update ResearchSurvey trending: %', SQLERRM;
    failed_tables := array_append(failed_tables, 'ResearchSurvey');
  END;

  -- =========================================================================
  -- 3. JOURNALS (Catalog Entity: 90-Day Window with Reviews & Rating)
  -- =========================================================================
  BEGIN
    UPDATE "Journal"
    SET "trendingScore" = 0
    WHERE "trendingScore" > 0
      AND ("updatedAt" < NOW() - INTERVAL '90 days' OR "isDeleted" = true OR "isFrozen" = true);

    UPDATE "Journal"
    SET "trendingScore" = (
      COALESCE("totalVotes", 0) +
      (COALESCE("totalComments", 0) * 1.5) +
      (COALESCE("totalBookmarks", 0) * 1.2) +
      -- Mirrors supervisor: (avg rating * review count * 5.0) -> ratingSum * 5.0
      (COALESCE("ratingSum"::float / NULLIF("reviewCount", 0), 0) * COALESCE("reviewCount", 0) * 5.0)
    ) / POW(EXTRACT(EPOCH FROM (NOW() - "updatedAt")) / 3600.0 + 2.0, gravity)
    WHERE "isDeleted" = false
      AND "isFrozen" = false
      AND "updatedAt" >= NOW() - INTERVAL '90 days';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to update Journal trending: %', SQLERRM;
    failed_tables := array_append(failed_tables, 'Journal');
  END;

  -- =========================================================================
  -- 4. SUPERVISORS (Catalog Entity: 90-Day Window with Recommendations)
  -- =========================================================================
  BEGIN
    UPDATE "Supervisor"
    SET "trendingScore" = 0
    WHERE "trendingScore" > 0
      AND ("updatedAt" < NOW() - INTERVAL '90 days' OR "isDeleted" = true OR "isFrozen" = true);

    UPDATE "Supervisor"
    SET "trendingScore" = (
      COALESCE("totalVotes", 0) +
      (COALESCE("totalComments", 0) * 2.0) +
      (COALESCE("totalBookmarks", 0) * 1.2) +
      (COALESCE("ratingSum"::float / NULLIF("recommendationCount", 0), 0) * COALESCE("recommendationCount", 0) * 5.0)
    ) / POW(EXTRACT(EPOCH FROM (NOW() - "updatedAt")) / 3600.0 + 2.0, gravity)
    WHERE "isDeleted" = false
      AND "isFrozen" = false
      AND "updatedAt" >= NOW() - INTERVAL '90 days';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to update Supervisor trending: %', SQLERRM;
    failed_tables := array_append(failed_tables, 'Supervisor');
  END;

  -- =========================================================================
  -- 5. SCHOLAR / USER TRENDING (Active within last 30 days)
  -- =========================================================================
  BEGIN
    UPDATE "User"
    SET "trendingScore" = 0
    WHERE "trendingScore" > 0
      AND ("updatedAt" < NOW() - INTERVAL '30 days' OR "isDeleted" = true OR "isFrozen" = true);

    UPDATE "User"
    SET "trendingScore" = (
      (COALESCE("reputation", 0) * 0.5) +
      (
        (
          COALESCE("articleCount", 0) +
          COALESCE("socialPostCount", 0) +
          COALESCE("academicPositionCount", 0) +
          COALESCE("admissionCount", 0) +
          COALESCE("callForPaperCount", 0) +
          COALESCE("helpPostCount", 0) +
          COALESCE("journalCount", 0) +
          COALESCE("journalReviewCount", 0) +
          COALESCE("researchToolCount", 0) +
          COALESCE("recommendationCount", 0) +
          COALESCE("supervisorCount", 0) +
          COALESCE("resultCount", 0) +
          COALESCE("contributionCount", 0) +
          COALESCE("publicationCount", 0) +
          COALESCE("surveyCount", 0) +
          COALESCE("surveyParticipationCount", 0) +
          COALESCE("researchGrantCount", 0) +
          COALESCE("courseCount", 0)
        ) * 0.5
      )
    ) / POW(EXTRACT(EPOCH FROM (NOW() - "updatedAt")) / 3600.0 + 2.0, gravity)
    WHERE "isDeleted" = false
      AND "isFrozen" = false
      AND "updatedAt" >= NOW() - INTERVAL '30 days';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to update User trending: %', SQLERRM;
    failed_tables := array_append(failed_tables, 'User');
  END;

  RETURN jsonb_build_object(
    'success', (cardinality(failed_tables) = 0),
    'failed_tables', failed_tables,
    'executed_at', NOW()
  );
END;
$$;
