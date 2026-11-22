-- Preserve the existing join-free activity feed while teaching historical
-- result rows whether they were exam notifications or result announcements.
-- Rows created after this migration store the same suffix in the action.
UPDATE "UserActivity" AS activity
SET "entityTitle" = activity."entityTitle" || '|||' || result."kind"::text
FROM "ExamsAndResults" AS result
WHERE activity."moduleType" = 'RESULT'
  AND activity."entityId" = result."id"
  AND activity."entityTitle" NOT LIKE '%|||%';
