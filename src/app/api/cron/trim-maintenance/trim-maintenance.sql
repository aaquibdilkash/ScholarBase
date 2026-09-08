CREATE OR REPLACE FUNCTION maintain_system_tables()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  messages_deleted integer := 0;
  activities_deleted integer := 0;
  notifications_deleted integer := 0;
  failed_tasks text[] := '{}';
BEGIN
  -- ---------------------------------------------------------------------
  -- 1. MESSAGES: Keep latest 100 messages per conversation
  -- ---------------------------------------------------------------------
  BEGIN
    WITH doomed_messages AS (
      SELECT id
      FROM (
        SELECT 
          id, 
          ROW_NUMBER() OVER(
            PARTITION BY "conversationId" 
            ORDER BY "createdAt" DESC
          ) AS rank
        FROM "Message"
      ) ranked
      WHERE ranked.rank > 100
    )
    DELETE FROM "Message"
    WHERE id IN (SELECT id FROM doomed_messages);

    GET DIAGNOSTICS messages_deleted = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed trimming messages: %', SQLERRM;
    failed_tasks := array_append(failed_tasks, 'Message');
  END;

  -- ---------------------------------------------------------------------
  -- 2. USER ACTIVITY: Keep latest 20 activities per user
  -- ---------------------------------------------------------------------
  BEGIN
    WITH doomed_activities AS (
      SELECT id
      FROM (
        SELECT 
          id, 
          ROW_NUMBER() OVER(
            PARTITION BY "userId" 
            ORDER BY "createdAt" DESC
          ) AS rank
        FROM "UserActivity"
      ) ranked
      WHERE ranked.rank > 20
    )
    DELETE FROM "UserActivity"
    WHERE id IN (SELECT id FROM doomed_activities);

    GET DIAGNOSTICS activities_deleted = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed trimming user activities: %', SQLERRM;
    failed_tasks := array_append(failed_tasks, 'UserActivity');
  END;

  -- ---------------------------------------------------------------------
  -- 3. NOTIFICATIONS: 
  --    - Purge read notifications older than 14 days
  --    - Cap unread notifications to latest 20 per recipient
  -- ---------------------------------------------------------------------
  BEGIN
    -- Step 3a: Remove stale read notifications
    DELETE FROM "Notification"
    WHERE "readAt" IS NOT NULL
      AND "createdAt" < NOW() - INTERVAL '14 days';

    -- Step 3b: Keep max 20 unread notifications per recipient
    WITH doomed_notifications AS (
      SELECT id
      FROM (
        SELECT 
          id, 
          ROW_NUMBER() OVER(
            PARTITION BY "recipientId" 
            ORDER BY "createdAt" DESC
          ) AS rank
        FROM "Notification"
        WHERE "readAt" IS NULL
      ) ranked
      WHERE ranked.rank > 20
    )
    DELETE FROM "Notification"
    WHERE id IN (SELECT id FROM doomed_notifications);

    GET DIAGNOSTICS notifications_deleted = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed trimming notifications: %', SQLERRM;
    failed_tasks := array_append(failed_tasks, 'Notification');
  END;

  RETURN jsonb_build_object(
    'success', (cardinality(failed_tasks) = 0),
    'messages_deleted', messages_deleted,
    'activities_deleted', activities_deleted,
    'notifications_deleted', notifications_deleted,
    'failed_tasks', failed_tasks,
    'executed_at', NOW()
  );
END;
$$;








-- 1. Safely remove any prior schedule with this name
DO $$
BEGIN
  PERFORM cron.unschedule('daily-table-maintenance');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- 2. Schedule daily execution at 04:00 AM UTC
SELECT cron.schedule(
  'daily-table-maintenance',
  '0 4 * * *',
  'SELECT maintain_system_tables();'
);