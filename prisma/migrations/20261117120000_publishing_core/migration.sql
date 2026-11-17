-- First-party publishing core: venues (journals + conferences), manuscripts,
-- immutable file versions, review tasks, venue-scoped editorial roles, the
-- public editorial board, and the append-only manuscript event log.
--
-- See docs/publishing-runbook.md. Two deliberate omissions:
--   * no vote/bookmark/comment counters — manuscripts are a workflow entity and
--     are not registered in ENTITY_CONFIG, CONTENT_TABLES, or tri-split;
--   * no embedding column — reviewer suggestion embeds the abstract on demand,
--     so no outbox trigger or worker branch is added here.

CREATE TYPE "public"."VenueType" AS ENUM ('JOURNAL', 'CONFERENCE');

CREATE TYPE "public"."ManuscriptStatus" AS ENUM (
  'SUBMITTED',
  'DESK_REJECTED',
  'UNDER_REVIEW',
  'REVISION_REQUIRED',
  'ACCEPTED_PROCEDINGS',
  'ACCEPTED_JOURNAL',
  'PUBLISHED',
  'REJECTED',
  'WITHDRAWN'
);

CREATE TYPE "public"."EditorialRoleTitle" AS ENUM ('EDITOR_IN_CHIEF', 'TRACK_CHAIR', 'ASSOC_EDITOR');

CREATE TYPE "public"."ReviewDecision" AS ENUM ('ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT');

CREATE TYPE "public"."ManuscriptEventType" AS ENUM (
  'SUBMITTED',
  'STATUS_CHANGED',
  'REVIEW_ASSIGNED',
  'REVIEW_SUBMITTED',
  'REVISION_UPLOADED',
  'TRANSFER_INVITED',
  'TRANSFER_DECLINED',
  'TRANSFERRED',
  'PUBLISHED',
  'WITHDRAWN'
);

CREATE TYPE "public"."DoiStatus" AS ENUM ('NONE', 'PENDING', 'MINTED', 'FAILED');

CREATE TABLE "public"."Venue" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "public"."VenueType" NOT NULL,
  "publisherName" TEXT NOT NULL DEFAULT 'ScholarBase',
  "issn" TEXT,
  "eissn" TEXT,
  "frequency" TEXT,
  "contactEmail" TEXT,
  "launchedAt" TIMESTAMP(3),
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "isDemo" BOOLEAN NOT NULL DEFAULT false,
  "aimsAndScope" TEXT,
  "authorGuidelines" TEXT,
  "peerReviewPolicy" TEXT,
  "ethicsPolicy" TEXT,
  "editorName" TEXT,
  "editorAffiliation" TEXT,
  "editorOrcid" TEXT,
  "licenseUrl" TEXT DEFAULT 'https://creativecommons.org/licenses/by/4.0/',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."Manuscript" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "abstract" TEXT,
  "keywords" TEXT,
  "status" "public"."ManuscriptStatus" NOT NULL DEFAULT 'SUBMITTED',
  "round" INTEGER NOT NULL DEFAULT 0,
  "venueId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "coAuthors" JSONB,
  "originalManuscriptId" TEXT,
  "doi" TEXT,
  "doiStatus" "public"."DoiStatus" NOT NULL DEFAULT 'NONE',
  "zenodoDepositId" TEXT,
  "isbn" TEXT,
  "volume" INTEGER,
  "issue" INTEGER,
  "firstPage" TEXT,
  "lastPage" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Manuscript_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ManuscriptFile" (
  "id" TEXT NOT NULL,
  "manuscriptId" TEXT NOT NULL,
  "round" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ManuscriptFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ReviewTask" (
  "id" TEXT NOT NULL,
  "manuscriptId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "round" INTEGER NOT NULL DEFAULT 0,
  "score" INTEGER,
  "decision" "public"."ReviewDecision",
  "inlineComments" JSONB,
  "isCompleted" BOOLEAN NOT NULL DEFAULT false,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "ReviewTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."EditorialRole" (
  "id" TEXT NOT NULL,
  "roleTitle" "public"."EditorialRoleTitle" NOT NULL,
  "userId" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,

  CONSTRAINT "EditorialRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."EditorialBoardMember" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "roleTitle" TEXT NOT NULL,
  "affiliation" TEXT,
  "orcid" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "venueId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EditorialBoardMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ManuscriptEvent" (
  "id" TEXT NOT NULL,
  "manuscriptId" TEXT NOT NULL,
  "type" "public"."ManuscriptEventType" NOT NULL,
  "actorId" TEXT,
  "fromStatus" "public"."ManuscriptStatus",
  "toStatus" "public"."ManuscriptStatus",
  "note" TEXT,
  "targetVenueId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ManuscriptEvent_pkey" PRIMARY KEY ("id")
);

-- Uniques. Slug and identifiers are typed in by an admin, so the database is the
-- last line of defence against a duplicate ISSN or DOI.
CREATE UNIQUE INDEX "Venue_slug_key" ON "public"."Venue"("slug");
CREATE UNIQUE INDEX "Venue_issn_key" ON "public"."Venue"("issn");
CREATE UNIQUE INDEX "Venue_eissn_key" ON "public"."Venue"("eissn");
CREATE UNIQUE INDEX "Manuscript_doi_key" ON "public"."Manuscript"("doi");
CREATE UNIQUE INDEX "ReviewTask_manuscriptId_reviewerId_round_key"
  ON "public"."ReviewTask"("manuscriptId", "reviewerId", "round");
CREATE UNIQUE INDEX "EditorialRole_userId_venueId_roleTitle_key"
  ON "public"."EditorialRole"("userId", "venueId", "roleTitle");

-- Read paths: venue home, author timeline, reviewer inbox, venue role lookup,
-- board ordering, manuscript timeline.
CREATE INDEX "Venue_type_isPublished_idx" ON "public"."Venue"("type", "isPublished");
CREATE INDEX "Manuscript_venueId_status_createdAt_idx"
  ON "public"."Manuscript"("venueId", "status", "createdAt" DESC);
CREATE INDEX "Manuscript_authorId_createdAt_idx"
  ON "public"."Manuscript"("authorId", "createdAt" DESC);
CREATE INDEX "Manuscript_originalManuscriptId_venueId_idx"
  ON "public"."Manuscript"("originalManuscriptId", "venueId");
CREATE INDEX "ManuscriptFile_manuscriptId_round_idx"
  ON "public"."ManuscriptFile"("manuscriptId", "round");
CREATE INDEX "ReviewTask_reviewerId_completedAt_assignedAt_idx"
  ON "public"."ReviewTask"("reviewerId", "completedAt", "assignedAt" DESC);
CREATE INDEX "EditorialRole_venueId_roleTitle_idx"
  ON "public"."EditorialRole"("venueId", "roleTitle");
CREATE INDEX "EditorialBoardMember_venueId_sortOrder_idx"
  ON "public"."EditorialBoardMember"("venueId", "sortOrder");
CREATE INDEX "ManuscriptEvent_manuscriptId_createdAt_idx"
  ON "public"."ManuscriptEvent"("manuscriptId", "createdAt");
CREATE INDEX "ManuscriptEvent_targetVenueId_type_idx"
  ON "public"."ManuscriptEvent"("targetVenueId", "type");

-- Foreign keys. Venue and author are RESTRICT (a published record must not
-- disappear because an account or venue row is hard-deleted); child rows that
-- only exist inside a manuscript cascade.
ALTER TABLE "public"."Manuscript"
  ADD CONSTRAINT "Manuscript_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "public"."Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."Manuscript"
  ADD CONSTRAINT "Manuscript_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."Manuscript"
  ADD CONSTRAINT "Manuscript_originalManuscriptId_fkey"
  FOREIGN KEY ("originalManuscriptId") REFERENCES "public"."Manuscript"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."ManuscriptFile"
  ADD CONSTRAINT "ManuscriptFile_manuscriptId_fkey"
  FOREIGN KEY ("manuscriptId") REFERENCES "public"."Manuscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ReviewTask"
  ADD CONSTRAINT "ReviewTask_manuscriptId_fkey"
  FOREIGN KEY ("manuscriptId") REFERENCES "public"."Manuscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ReviewTask"
  ADD CONSTRAINT "ReviewTask_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."EditorialRole"
  ADD CONSTRAINT "EditorialRole_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."EditorialRole"
  ADD CONSTRAINT "EditorialRole_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "public"."Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."EditorialBoardMember"
  ADD CONSTRAINT "EditorialBoardMember_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "public"."Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ManuscriptEvent"
  ADD CONSTRAINT "ManuscriptEvent_manuscriptId_fkey"
  FOREIGN KEY ("manuscriptId") REFERENCES "public"."Manuscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ManuscriptEvent"
  ADD CONSTRAINT "ManuscriptEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."ManuscriptEvent"
  ADD CONSTRAINT "ManuscriptEvent_targetVenueId_fkey"
  FOREIGN KEY ("targetVenueId") REFERENCES "public"."Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
