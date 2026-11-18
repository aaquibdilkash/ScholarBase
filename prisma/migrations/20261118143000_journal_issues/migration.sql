CREATE TYPE "public"."JournalIssueStatus" AS ENUM ('DRAFT', 'OPEN', 'LOCKED', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "public"."JournalIssue" (
  "id" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "volume" INTEGER NOT NULL,
  "number" INTEGER NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "status" "public"."JournalIssueStatus" NOT NULL DEFAULT 'DRAFT',
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publicationDate" TIMESTAMP(3),
  "coverImageUrl" TEXT,
  "doi" TEXT,
  "editorialHtml" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JournalIssue_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."Manuscript" ADD COLUMN "journalIssueId" TEXT;

-- Backfill one issue per existing journal volume/issue pair so existing
-- articles remain grouped without changing their citation snapshots.
INSERT INTO "public"."JournalIssue" ("id", "venueId", "volume", "number", "status", "isPublished", "publicationDate", "createdAt", "updatedAt")
SELECT
  md5('legacy-journal-issue:' || m."venueId" || ':' || m."volume" || ':' || m."issue"),
  m."venueId", m."volume", COALESCE(m."issue", 1),
  'PUBLISHED'::"public"."JournalIssueStatus",
  v."isPublished",
  MAX(m."publishedAt"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "public"."Manuscript" m
JOIN "public"."Venue" v ON v."id" = m."venueId"
WHERE v."type" = 'JOURNAL' AND m."volume" IS NOT NULL AND m."status" = 'PUBLISHED'
GROUP BY m."venueId", m."volume", m."issue", v."isPublished";

UPDATE "public"."Manuscript" m
SET "journalIssueId" = md5('legacy-journal-issue:' || m."venueId" || ':' || m."volume" || ':' || m."issue")
FROM "public"."Venue" v
WHERE m."venueId" = v."id" AND v."type" = 'JOURNAL'
  AND m."volume" IS NOT NULL AND m."status" = 'PUBLISHED';

CREATE UNIQUE INDEX "JournalIssue_venueId_volume_number_key" ON "public"."JournalIssue"("venueId", "volume", "number");
CREATE UNIQUE INDEX "JournalIssue_doi_key" ON "public"."JournalIssue"("doi");
CREATE INDEX "JournalIssue_venueId_isPublished_publicationDate_idx" ON "public"."JournalIssue"("venueId", "isPublished", "publicationDate" DESC);
CREATE INDEX "JournalIssue_venueId_status_idx" ON "public"."JournalIssue"("venueId", "status");
CREATE INDEX "Manuscript_journalIssueId_status_createdAt_idx" ON "public"."Manuscript"("journalIssueId", "status", "createdAt" DESC);

ALTER TABLE "public"."JournalIssue" ADD CONSTRAINT "JournalIssue_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "public"."Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Manuscript" ADD CONSTRAINT "Manuscript_journalIssueId_fkey"
  FOREIGN KEY ("journalIssueId") REFERENCES "public"."JournalIssue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
