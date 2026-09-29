

### The Updated `update_trending_scores()` Function

Run this script in your Supabase SQL Editor:

```sql
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
    'Publication',
    'ResearchTool',
    'ResearchGrant',
    'Course',
    'Result',
    'ResearchEvent',
    'PhdAdmission',
    'JobVacancy',
    'Recommendation',
    'JournalReview'   -- Added JournalReview
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
          COALESCE("jobVacancyCount", 0) +
          COALESCE("phdAdmissionCount", 0) +
          COALESCE("researchEventCount", 0) +
          COALESCE("helpPostCount", 0) +
          COALESCE("journalCount", 0) +
          COALESCE("journalReviewCount", 0) +     -- Added missing journalReviewCount
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

```

---

### Schedule the Cron Job

Now register the new job to run once daily at 02:00 UTC (07:30 IST):

```sql
-- 1. Ensure pg_cron is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Safely remove any existing job with this name
DO $$
BEGIN
  PERFORM cron.unschedule('update-trending-scores');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Schedule the single clean job
SELECT cron.schedule(
  'update-trending-scores',
  '0 2 * * *',
  'SELECT update_trending_scores();'
);

```

---

### Immediate Test & Verification

Test-run the function right now in the SQL Editor without waiting for 2:00 AM:

```sql
SELECT update_trending_scores();

```

*Expected output:* `{"success": true, "failed_tables": [], "executed_at": "..."}`

Verify the cron schedule:

```sql
SELECT jobid, jobname, schedule, active, command FROM cron.job;

```