-- P2-1 — make notification fan-out idempotent.
--
-- Two defects let a replayed fan-out duplicate notifications:
--
--   1. The chunk cursor lived in a local variable inside
--      `processNotificationPayload`, and QStash is configured with `retries: 3`.
--      Any timeout or crash mid-loop therefore restarted the walk from the
--      FIRST follower, re-inserting everyone already processed.
--   2. Nothing in the database forbade a second unread row for the same
--      (recipient, target, type) triple, so the replay inserted silently
--      instead of failing loudly.
--
-- The TARGETED rollup path in the same file already assumes ONE unread row per
-- triple — it calls `findFirst({ recipientId, targetId, type, readAt: null })`
-- and increments `count` when it finds one. This index promotes that assumption
-- from a convention to a database guarantee, which is what makes the replay a
-- no-op once `createMany({ skipDuplicates: true })` is in place.
--
-- Why PARTIAL (`WHERE "readAt" IS NULL`) rather than a plain unique constraint:
--
--   * A read notification must NOT block a fresh one. Without the predicate a
--     user would silently stop being notified about something they had already
--     read (a second comment on the same post, a second vote, a re-follow).
--     The existing `readAt: null` lookups are precisely "unread" queries, so
--     the predicate matches how the code already reasons.
--   * `targetId` is nullable, and NULLs compare as distinct in a Postgres unique
--     index, so rows with a NULL targetId could never collide. Excluding them
--     keeps the index meaningful for rows that predate the current payload
--     contract (`targetId: z.string().min(1)`).
--
-- Step 1 collapses duplicates that a previous replay may already have created,
-- preserving the newest row and folding the others' rollup counts into it so no
-- tally is silently lost. Both statements are no-ops on clean data.

-- 1a. Fold every duplicate group's counts into the survivor (newest row).
WITH ranked AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "recipientId", "targetId", "type"
            ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
        ) AS rn,
        SUM("count") OVER (
            PARTITION BY "recipientId", "targetId", "type"
        ) AS total_count
    FROM "Notification"
    WHERE "readAt" IS NULL AND "targetId" IS NOT NULL
)
UPDATE "Notification" n
SET "count" = r.total_count
FROM ranked r
WHERE n."id" = r."id"
  AND r.rn = 1
  AND n."count" <> r.total_count;

-- 1b. Drop the now-redundant rows.
WITH ranked AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "recipientId", "targetId", "type"
            ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
        ) AS rn
    FROM "Notification"
    WHERE "readAt" IS NULL AND "targetId" IS NOT NULL
)
DELETE FROM "Notification" n
USING ranked r
WHERE n."id" = r."id"
  AND r.rn > 1;

-- 2. Enforce one unread row per triple from here on.
--
-- NOTE: Prisma cannot model partial indexes, so this one is intentionally
-- invisible to schema.prisma. `prisma migrate dev` may propose dropping it as
-- drift; it must NOT be dropped. If that happens, re-create it by hand or via
-- this migration.
CREATE UNIQUE INDEX "Notification_unread_dedupe_key"
    ON "public"."Notification" ("recipientId", "targetId", "type")
    WHERE "readAt" IS NULL AND "targetId" IS NOT NULL;
