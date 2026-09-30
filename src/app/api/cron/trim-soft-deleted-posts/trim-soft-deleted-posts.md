

### The Updated `purge_soft_deleted_records()` Function

Run this script in your Supabase SQL Editor:

```sql
CREATE OR REPLACE FUNCTION purge_soft_deleted_records()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tbl text;
  rows_deleted integer := 0;
  total_content_deleted integer := 0;
  total_comments_deleted integer := 0;
  total_users_deleted integer := 0;
  total_assets_queued integer := 0;
  assets_count integer := 0;
  audit_log jsonb := '{}'::jsonb;
  failed_tables text[] := '{}';

  -- Ephemeral content tables (Safe to purge after 30 days)
  content_tables text[] := ARRAY[
    'Article', 'SocialPost', 'HelpPost', 'Contribution',
    'Publication', 'ResearchTool', 'ResearchGrant', 'Course',
    'Result', 'ResearchSurvey', 'ResearchEvent',
    'PhdAdmission', 'JobVacancy', 'Recommendation', 'JournalReview'
  ];

  -- All comment tables (No phantom 'Reply' table)
  comment_tables text[] := ARRAY[
    'ArticleComment', 'SocialComment', 'HelpPostComment', 'ContributionComment',
    'JobVacancyComment', 'PhdAdmissionComment', 'ResearchEventComment', 'SupervisorComment',
    'RecommendationComment', 'ResearchToolComment', 'ResearchGrantComment', 'CourseComment',
    'JournalComment', 'JournalReviewComment', 'ResultComment', 'PublicationComment', 'SurveyComment'
  ];
BEGIN
  -- =========================================================================
  -- 1. QUEUE ORPHANED CLOUDINARY IMAGES (BEFORE HARD DELETION)
  -- =========================================================================

  -- A. User Avatars
  INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
  SELECT gen_random_uuid()::text, "avatarUrl", NOW()
  FROM "User"
  WHERE "isDeleted" = true 
    AND "updatedAt" < NOW() - INTERVAL '30 days'
    AND "avatarUrl" IS NOT NULL
    AND "avatarUrl" LIKE '%res.cloudinary.com%';
  GET DIAGNOSTICS assets_count = ROW_COUNT;
  total_assets_queued := total_assets_queued + assets_count;

  -- B. SocialPost Single Image
  INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
  SELECT gen_random_uuid()::text, "imageUrl", NOW()
  FROM "SocialPost"
  WHERE "isDeleted" = true 
    AND "updatedAt" < NOW() - INTERVAL '30 days'
    AND "imageUrl" IS NOT NULL
    AND "imageUrl" LIKE '%res.cloudinary.com%';
  GET DIAGNOSTICS assets_count = ROW_COUNT;
  total_assets_queued := total_assets_queued + assets_count;

  -- C. SocialPost Image Array (Unnested text[])
  INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
  SELECT gen_random_uuid()::text, unnested_url, NOW()
  FROM (
    SELECT unnest("imageUrls") AS unnested_url
    FROM "SocialPost"
    WHERE "isDeleted" = true 
      AND "updatedAt" < NOW() - INTERVAL '30 days'
      AND "imageUrls" IS NOT NULL
  ) s
  WHERE unnested_url LIKE '%res.cloudinary.com%';
  GET DIAGNOSTICS assets_count = ROW_COUNT;
  total_assets_queued := total_assets_queued + assets_count;

  -- D. Contribution Payment Screenshots
  INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
  SELECT gen_random_uuid()::text, "screenshotUrl", NOW()
  FROM "Contribution"
  WHERE "isDeleted" = true 
    AND "updatedAt" < NOW() - INTERVAL '30 days'
    AND "screenshotUrl" IS NOT NULL
    AND "screenshotUrl" LIKE '%res.cloudinary.com%';
  GET DIAGNOSTICS assets_count = ROW_COUNT;
  total_assets_queued := total_assets_queued + assets_count;


  -- =========================================================================
  -- 2. PURGE COMMENTS
  -- =========================================================================
  FOREACH tbl IN ARRAY comment_tables
  LOOP
    BEGIN
      EXECUTE format('
        DELETE FROM %I
        WHERE "isDeleted" = true
          AND "updatedAt" < NOW() - INTERVAL ''30 days''
      ', tbl);
      GET DIAGNOSTICS rows_deleted = ROW_COUNT;
      total_comments_deleted := total_comments_deleted + rows_deleted;
      audit_log := jsonb_set(audit_log, ARRAY[tbl], to_jsonb(rows_deleted));
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed purging comments on %: %', tbl, SQLERRM;
      failed_tables := array_append(failed_tables, tbl);
    END;
  END LOOP;


  -- =========================================================================
  -- 3. PURGE EPHEMERAL CONTENT
  -- =========================================================================
  FOREACH tbl IN ARRAY content_tables
  LOOP
    BEGIN
      EXECUTE format('
        DELETE FROM %I
        WHERE "isDeleted" = true
          AND "updatedAt" < NOW() - INTERVAL ''30 days''
      ', tbl);
      GET DIAGNOSTICS rows_deleted = ROW_COUNT;
      total_content_deleted := total_content_deleted + rows_deleted;
      audit_log := jsonb_set(audit_log, ARRAY[tbl], to_jsonb(rows_deleted));
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed purging content on %: %', tbl, SQLERRM;
      failed_tables := array_append(failed_tables, tbl);
    END;
  END LOOP;


  -- =========================================================================
  -- 4. CONDITIONAL PURGE: SUPERVISORS & JOURNALS (PROTECT REVIEWS)
  -- =========================================================================
  
  -- Only purge soft-deleted Supervisors if they have ZERO recommendations attached
  BEGIN
    DELETE FROM "Supervisor"
    WHERE "isDeleted" = true
      AND "updatedAt" < NOW() - INTERVAL '30 days'
      AND "recommendationCount" = 0
      AND NOT EXISTS (
        SELECT 1 FROM "Recommendation" r WHERE r."supervisorId" = "Supervisor"."id"
      );
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    total_content_deleted := total_content_deleted + rows_deleted;
    audit_log := jsonb_set(audit_log, ARRAY['Supervisor'], to_jsonb(rows_deleted));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed purging empty supervisors: %', SQLERRM;
    failed_tables := array_append(failed_tables, 'Supervisor');
  END;

  -- Only purge soft-deleted Journals if they have ZERO reviews and ZERO publications attached
  BEGIN
    DELETE FROM "Journal"
    WHERE "isDeleted" = true
      AND "updatedAt" < NOW() - INTERVAL '30 days'
      AND "reviewCount" = 0
      AND NOT EXISTS (
        SELECT 1 FROM "JournalReview" jr WHERE jr."journalId" = "Journal"."id"
      )
      AND NOT EXISTS (
        SELECT 1 FROM "Publication" p WHERE p."journalId" = "Journal"."id"
      );
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    total_content_deleted := total_content_deleted + rows_deleted;
    audit_log := jsonb_set(audit_log, ARRAY['Journal'], to_jsonb(rows_deleted));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed purging empty journals: %', SQLERRM;
    failed_tables := array_append(failed_tables, 'Journal');
  END;


  -- =========================================================================
  -- 5. PURGE EXPIRED USERS
  -- =========================================================================
  BEGIN
    DELETE FROM "User"
    WHERE "isDeleted" = true
      AND "updatedAt" < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    total_users_deleted := rows_deleted;
    audit_log := jsonb_set(audit_log, ARRAY['User'], to_jsonb(rows_deleted));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed purging expired users: %', SQLERRM;
    failed_tables := array_append(failed_tables, 'User');
  END;

  RETURN jsonb_build_object(
    'success', (cardinality(failed_tables) = 0),
    'orphaned_assets_queued', total_assets_queued,
    'total_content_deleted', total_content_deleted,
    'total_comments_deleted', total_comments_deleted,
    'total_users_deleted', total_users_deleted,
    'failed_tables', failed_tables,
    'breakdown', audit_log,
    'executed_at', NOW()
  );
END;
$$;

```

---

### Schedule the Cleanup Cron Job

Schedule this maintenance job to run once weekly (e.g., every Sunday at 03:00 UTC / 08:30 IST):

```sql
-- 1. Safely unschedule previous purge job if present
DO $$
BEGIN
  PERFORM cron.unschedule('purge-soft-deleted-records');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Schedule to run weekly every Sunday at 03:00 UTC
SELECT cron.schedule(
  'purge-soft-deleted-records',
  '0 3 * * 0',
  'SELECT purge_soft_deleted_records();'
);

```

---

### Verification

Test-run the function immediately in your SQL Editor:

```sql
SELECT purge_soft_deleted_records();

```

Confirm both cron jobs are registered and active:

```sql
SELECT jobid, jobname, schedule, active, command FROM cron.job;

```