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
    'Journal', 'Result', 'ResearchSurvey', 'ResearchEvent',
    'PhdAdmission', 'JobVacancy', 'Recommendation', 'Supervisor'
  ];

  comment_tables text[] := ARRAY[
    'ArticleComment', 'SocialComment', 'HelpPostComment', 'ContributionComment',
    'JobVacancyComment', 'PhdAdmissionComment', 'ResearchEventComment', 'SupervisorComment',
    'RecommendationComment', 'ResearchToolComment', 'ResearchGrantComment', 'CourseComment',
    'JournalComment', 'ResultComment', 'PublicationComment', 'SurveyComment', 'Reply'
  ];
BEGIN
  -- -----------------------------------------------------------
  -- 1. QUEUE ORPHANED CLOUDINARY IMAGES BEFORE HARD DELETIONS
  -- -----------------------------------------------------------
  
  -- From Users (avatarUrl)
  INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
  SELECT gen_random_uuid()::text, "avatarUrl", NOW()
  FROM "User"
  WHERE "isDeleted" = true 
    AND "updatedAt" < NOW() - INTERVAL '30 days'
    AND "avatarUrl" IS NOT NULL
    AND "avatarUrl" LIKE '%res.cloudinary.com%';
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
      AND "imageUrl" LIKE '%res.cloudinary.com%';
    GET DIAGNOSTICS assets_count = ROW_COUNT;
    total_assets_queued := total_assets_queued + assets_count;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- From Article (coverImage / imageUrl)
  BEGIN
    INSERT INTO "OrphanedAsset" ("id", "url", "createdAt")
    SELECT gen_random_uuid()::text, "coverImage", NOW()
    FROM "Article"
    WHERE "isDeleted" = true 
      AND "updatedAt" < NOW() - INTERVAL '30 days'
      AND "coverImage" IS NOT NULL
      AND "coverImage" LIKE '%res.cloudinary.com%';
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