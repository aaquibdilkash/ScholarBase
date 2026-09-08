-- declare the function to update trending scores for various tables and users in the database

CREATE OR REPLACE FUNCTION update_trending_scores()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tbl text;
  gravity constant numeric := 1.8;
  failed_tables text[] := '{}';
  target_tables text[] := ARRAY[
    'Article',
    'SocialPost',
    'HelpPost',
    'Contribution',
    'Publication',
    'ResearchTool',
    'ResearchGrant',
    'Course',
    'Journal',
    'Result',
    'ResearchSurvey',
    'ResearchEvent',
    'PhdAdmission',
    'JobVacancy',
    'Recommendation'
  ];
BEGIN
  -- 1. Standard Content (7-Day Cutoff)
  FOREACH tbl IN ARRAY target_tables
  LOOP
    BEGIN
      EXECUTE format('
        UPDATE %I
        SET "trendingScore" = (
          COALESCE("totalVotes", 0) + (COALESCE("totalComments", 0) * 1.5)
        ) / POW(EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 3600.0 + 2.0, %s)
        WHERE "createdAt" >= NOW() - INTERVAL ''7 days''
          AND "isDeleted" = false
      ', tbl, gravity);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to update trending score for table %: %', tbl, SQLERRM;
      failed_tables := array_append(failed_tables, tbl);
    END;
  END LOOP;

  -- 2. Scholar Trending (Active within last 30 days; 50% Reputation + 50% Activities)
  BEGIN
    -- Reset dormant users (> 30 days inactive) to 0
    UPDATE "User"
    SET "trendingScore" = 0
    WHERE "isDeleted" = false 
      AND "updatedAt" < NOW() - INTERVAL '30 days';

    -- Score active scholars
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
      AND "updatedAt" >= NOW() - INTERVAL '30 days';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to update User trending: %', SQLERRM;
    failed_tables := array_append(failed_tables, 'User');
  END;

  -- 3. Supervisor Trending (Profiles created or active within last 90 days)
  BEGIN
    UPDATE "Supervisor"
    SET "trendingScore" = 0
    WHERE "isDeleted" = false 
      AND "createdAt" < NOW() - INTERVAL '90 days';

    UPDATE "Supervisor"
    SET "trendingScore" = (
      COALESCE("totalVotes", 0) + 
      (COALESCE("totalComments", 0) * 2.0) + 
      (COALESCE("ratingSum"::float / NULLIF("recommendationCount", 0), 0) * COALESCE("recommendationCount", 0) * 5.0)
    ) / POW(EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 3600.0 + 2.0, gravity)
    WHERE "isDeleted" = false
      AND "createdAt" >= NOW() - INTERVAL '90 days';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to update Supervisor trending: %', SQLERRM;
    failed_tables := array_append(failed_tables, 'Supervisor');
  END;

  RETURN jsonb_build_object(
    'success', (cardinality(failed_tables) = 0),
    'failed_tables', failed_tables,
    'executed_at', NOW()
  );
END;
$$;












-- to set the cron job for the above function, you can use the following SQL commands:

-- 1. Enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Safely unschedule only if the job already exists
DO $$
BEGIN
  PERFORM cron.unschedule('update-trending-scores');
EXCEPTION WHEN OTHERS THEN
  -- Ignore error if the job doesn't exist yet
  NULL;
END;
$$;

-- 3. Schedule the trending calculation to run ONCE DAILY at 02:00 AM UTC (07:30 AM IST)
SELECT cron.schedule(
  'update-trending-scores',
  '0 2 * * *',
  'SELECT update_trending_scores();'
);







-- To check the current cron jobs, you can run the following query:

SELECT jobid, jobname, schedule, active, command 
FROM cron.job;




-- to check the last 5 runs of the cron job, you can use the following query:

SELECT 
  runid, 
  status, 
  return_message, 
  start_time, 
  end_time,
  ROUND(EXTRACT(EPOCH FROM (end_time - start_time))::numeric, 2) AS duration_seconds
FROM cron.job_run_details
WHERE jobid = 1
ORDER BY start_time DESC
LIMIT 5;



SELECT jobid, jobname, schedule, active, command 
FROM cron.job;