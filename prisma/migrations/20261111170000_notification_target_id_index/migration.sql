-- P0-1: support targeted notification cleanup on content delete / anon toggle.
--
-- Every content delete needs `deleteMany({ where: { targetId: X } })` inside the
-- same transaction that soft-deletes the row. Without a plain index on `targetId`
-- that delete would sequential-scan the whole Notification table (fan-out can
-- mean thousands of rows per post), so this b-tree makes each cleanup an index
-- scan over a handful of rows.
--
-- Prisma can model this index, so it also lives in schema.prisma. This migration
-- is the canonical application path; `prisma migrate dev` should not propose
-- dropping it as drift.

CREATE INDEX "Notification_targetId_idx" ON "public"."Notification"("targetId");
