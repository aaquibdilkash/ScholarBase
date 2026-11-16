-- Survey response notifications roll up into one unread row per survey
-- (the partial unique index `Notification_unread_dedupe_key` keys on
--  (recipientId, targetId, type)). Reword existing unread rows so the title
--  no longer reads as belonging to a single respondent; the actor name and
--  count badge are resolved at render time instead.
UPDATE "public"."Notification"
SET "title" = 'New response to your survey',
    "updatedAt" = NOW()
WHERE "type" = 'survey-response'
  AND "readAt" IS NULL;
