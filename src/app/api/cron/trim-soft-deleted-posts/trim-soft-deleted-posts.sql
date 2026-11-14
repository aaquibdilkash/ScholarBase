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

  content_tables text[] := ARRAY[
    'Article', 'SocialPost', 'HelpPost', 'Contribution',
    'Publication', 'ResearchTool', 'ResearchGrant', 'Course',
    'Journal', 'Result', 'ResearchSurvey', 'CallForPaper',
    'Admission', 'AcademicPosition', 'Recommendation', 'Supervisor'
  ];

  comment_tables text[] := ARRAY[
    'ArticleComment', 'SocialComment', 'HelpPostComment', 'ContributionComment',
    'AcademicPositionComment', 'AdmissionComment', 'CallForPaperComment', 'SupervisorComment',
    'RecommendationComment', 'ResearchToolComment', 'ResearchGrantComment', 'CourseComment',
    'JournalComment', 'ResultComment', 'PublicationComment', 'SurveyComment', 'Reply'
  ];
BEGIN
  -- -----------------------------------------------------------
  -- 1. QUEUE ORPHANED CONTENT IMAGES BEFORE HARD DELETIONS
  -- -----------------------------------------------------------
  -- Every filter matches the URL PATH, not the host: this deployment serves
  -- Supabase Storage from a custom domain (api.staging.scholarbase.app), so a
  -- `supabase.co` pattern would never match anything.

  -- From Users (avatarUrl)
  INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
  SELECT gen_random_uuid()::text, "avatarUrl", NOW()
  FROM "User"
  WHERE "isDeleted" = true 
    AND "updatedAt" < NOW() - INTERVAL '30 days'
    AND "avatarUrl" IS NOT NULL
    AND "avatarUrl" LIKE '%/storage/v1/object/public/content-images/%';
  GET DIAGNOSTICS assets_count = ROW_COUNT;
  total_assets_queued := total_assets_queued + assets_count;

  -- From SocialPost (imageUrl)
  BEGIN
    INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
    SELECT gen_random_uuid()::text, "imageUrl", NOW()
    FROM "SocialPost"
    WHERE "isDeleted" = true 
      AND "updatedAt" < NOW() - INTERVAL '30 days'
      AND "imageUrl" IS NOT NULL
      AND "imageUrl" LIKE '%/storage/v1/object/public/content-images/%';
    GET DIAGNOSTICS assets_count = ROW_COUNT;
    total_assets_queued := total_assets_queued + assets_count;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- From SocialPost (imageUrls array)
  BEGIN
    INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
    SELECT gen_random_uuid()::text, unnested_url, NOW()
    FROM (
      SELECT unnest("imageUrls") AS unnested_url
      FROM "SocialPost"
      WHERE "isDeleted" = true
        AND "updatedAt" < NOW() - INTERVAL '30 days'
        AND "imageUrls" IS NOT NULL
    ) s
    WHERE unnested_url LIKE '%/storage/v1/object/public/content-images/%';
    GET DIAGNOSTICS assets_count = ROW_COUNT;
    total_assets_queued := total_assets_queued + assets_count;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- From Contribution (screenshotUrl)
  BEGIN
    INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
    SELECT gen_random_uuid()::text, "screenshotUrl", NOW()
    FROM "Contribution"
    WHERE "isDeleted" = true
      AND "updatedAt" < NOW() - INTERVAL '30 days'
      AND "screenshotUrl" IS NOT NULL
      AND "screenshotUrl" LIKE '%/storage/v1/object/public/content-images/%';
    GET DIAGNOSTICS assets_count = ROW_COUNT;
    total_assets_queued := total_assets_queued + assets_count;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- From Article (imageUrl - Supabase)
  -- The URL PATH is matched, not the host: this deployment serves Supabase
  -- Storage from a custom domain (api.staging.scholarbase.app), so a
  -- `supabase.co` pattern would never match anything.
  BEGIN
    INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
    SELECT gen_random_uuid()::text, "imageUrl", NOW()
    FROM "Article"
    WHERE "isDeleted" = true 
      AND "updatedAt" < NOW() - INTERVAL '30 days'
      AND "imageUrl" IS NOT NULL
      AND "imageUrl" LIKE '%/storage/v1/object/public/content-images/%';
    GET DIAGNOSTICS assets_count = ROW_COUNT;
    total_assets_queued := total_assets_queued + assets_count;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- From Article description (inline images - Supabase)
  -- Extracts every Supabase Storage URL referenced in the article body HTML.
  BEGIN
    INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
    SELECT gen_random_uuid()::text, (m)[1], NOW()
    FROM "Article",
    LATERAL regexp_matches("content", '(https?://[^"]*/storage/v1/object/public/content-images/[^"]+)', 'g') AS m
    WHERE "isDeleted" = true 
      AND "updatedAt" < NOW() - INTERVAL '30 days'
      AND "content" LIKE '%/storage/v1/object/public/content-images/%';
    GET DIAGNOSTICS assets_count = ROW_COUNT;
    total_assets_queued := total_assets_queued + assets_count;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- From CallForPaper (imageUrl - Supabase)
  BEGIN
    INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
    SELECT gen_random_uuid()::text, "imageUrl", NOW()
    FROM "CallForPaper"
    WHERE "isDeleted" = true 
      AND "updatedAt" < NOW() - INTERVAL '30 days'
      AND "imageUrl" IS NOT NULL
      AND "imageUrl" LIKE '%/storage/v1/object/public/content-images/%';
    GET DIAGNOSTICS assets_count = ROW_COUNT;
    total_assets_queued := total_assets_queued + assets_count;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- From CallForPaper description (inline images - Supabase)
  BEGIN
    INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
    SELECT gen_random_uuid()::text, (m)[1], NOW()
    FROM "CallForPaper",
    LATERAL regexp_matches("description", '(https?://[^"]*/storage/v1/object/public/content-images/[^"]+)', 'g') AS m
    WHERE "isDeleted" = true 
      AND "updatedAt" < NOW() - INTERVAL '30 days'
      AND "description" LIKE '%/storage/v1/object/public/content-images/%';
    GET DIAGNOSTICS assets_count = ROW_COUNT;
    total_assets_queued := total_assets_queued + assets_count;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- From Admission (imageUrl - Supabase)
  BEGIN
    INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
    SELECT gen_random_uuid()::text, "imageUrl", NOW()
    FROM "Admission"
    WHERE "isDeleted" = true 
      AND "updatedAt" < NOW() - INTERVAL '30 days'
      AND "imageUrl" IS NOT NULL
      AND "imageUrl" LIKE '%/storage/v1/object/public/content-images/%';
    GET DIAGNOSTICS assets_count = ROW_COUNT;
    total_assets_queued := total_assets_queued + assets_count;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- From Admission description (inline images - Supabase)
  BEGIN
    INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
    SELECT gen_random_uuid()::text, (m)[1], NOW()
    FROM "Admission",
    LATERAL regexp_matches("description", '(https?://[^"]*/storage/v1/object/public/content-images/[^"]+)', 'g') AS m
    WHERE "isDeleted" = true 
      AND "updatedAt" < NOW() - INTERVAL '30 days'
      AND "description" LIKE '%/storage/v1/object/public/content-images/%';
    GET DIAGNOSTICS assets_count = ROW_COUNT;
    total_assets_queued := total_assets_queued + assets_count;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- From AcademicPosition (imageUrl - Supabase)
  BEGIN
    INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
    SELECT gen_random_uuid()::text, "imageUrl", NOW()
    FROM "AcademicPosition"
    WHERE "isDeleted" = true 
      AND "updatedAt" < NOW() - INTERVAL '30 days'
      AND "imageUrl" IS NOT NULL
      AND "imageUrl" LIKE '%/storage/v1/object/public/content-images/%';
    GET DIAGNOSTICS assets_count = ROW_COUNT;
    total_assets_queued := total_assets_queued + assets_count;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- From AcademicPosition description (inline images - Supabase)
  BEGIN
    INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
    SELECT gen_random_uuid()::text, (m)[1], NOW()
    FROM "AcademicPosition",
    LATERAL regexp_matches("description", '(https?://[^"]*/storage/v1/object/public/content-images/[^"]+)', 'g') AS m
    WHERE "isDeleted" = true 
      AND "updatedAt" < NOW() - INTERVAL '30 days'
      AND "description" LIKE '%/storage/v1/object/public/content-images/%';
    GET DIAGNOSTICS assets_count = ROW_COUNT;
    total_assets_queued := total_assets_queued + assets_count;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- -----------------------------------------------------------
  -- 2. PURGE COMMENTS & REPLIES
  -- -----------------------------------------------------------
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
      failed_tables := array_append(failed_tables, tbl);
    END;
  END LOOP;

  -- -----------------------------------------------------------
  -- 3. PURGE CONTENT (CASCADES CHILD RELATIONS)
  -- -----------------------------------------------------------
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
      failed_tables := array_append(failed_tables, tbl);
    END;
  END LOOP;

  -- -----------------------------------------------------------
  -- 4. PURGE EXPIRED USERS
  -- -----------------------------------------------------------
  BEGIN
    DELETE FROM "User"
    WHERE "isDeleted" = true
      AND "updatedAt" < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    total_users_deleted := rows_deleted;
    audit_log := jsonb_set(audit_log, ARRAY['User'], to_jsonb(rows_deleted));
  EXCEPTION WHEN OTHERS THEN
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