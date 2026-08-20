-- Migration: optimize-counters-tombstones-indexes
-- Additive, idempotent (IF NOT EXISTS) statements. Only affects read performance.

-- User: the scholar directory (getScholars / getTrendingScholars) orders by
-- reputation and createdAt. No indexes previously existed on these columns, so
-- every listing triggered a full-table filesort (ORDER BY ... LIMIT).
CREATE INDEX IF NOT EXISTS "User_reputation_idx" ON "User" ("reputation" DESC);
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User" ("createdAt" DESC);

-- UserActivity: getProfileSections reads the activity log filtered by
-- (userId, action) and ordered by createdAt DESC. The existing
-- (userId, createdAt) index can't serve the extra `action` predicate, so this
-- composite covers the full read pattern.
CREATE INDEX IF NOT EXISTS "UserActivity_userId_action_createdAt_idx"
  ON "UserActivity" ("userId", "action", "createdAt" DESC);
