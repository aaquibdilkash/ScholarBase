CREATE TYPE "public"."ConferenceEditionStatus" AS ENUM (
  'DRAFT', 'CFP_OPEN', 'REVIEW', 'NOTIFICATION', 'PROGRAM', 'COMPLETED', 'ARCHIVED'
);

CREATE TABLE "public"."ConferenceEdition" (
  "id" TEXT NOT NULL,
  "venueId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "term" TEXT,
  "slug" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" "public"."ConferenceEditionStatus" NOT NULL DEFAULT 'DRAFT',
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "location" TEXT,
  "timezone" TEXT,
  "websiteUrl" TEXT,
  "cfpOpenAt" TIMESTAMP(3),
  "submissionDeadline" TIMESTAMP(3),
  "notificationAt" TIMESTAMP(3),
  "cameraReadyAt" TIMESTAMP(3),
  "volume" INTEGER,
  "isbn" TEXT,
  "proceedingsDoi" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConferenceEdition_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."Manuscript" ADD COLUMN "editionId" TEXT;

-- Preserve existing conference records in one explicit legacy occurrence per
-- venue. New occurrences are created from the workspace; this backfill keeps
-- already-published papers citable while the edition layer is introduced.
INSERT INTO "public"."ConferenceEdition" (
  "id", "venueId", "year", "slug", "label", "status", "isPublished", "volume", "isbn", "createdAt", "updatedAt"
)
SELECT
  md5('legacy-conference-edition:' || v."id"),
  v."id",
  COALESCE(EXTRACT(YEAR FROM v."launchedAt")::integer, EXTRACT(YEAR FROM CURRENT_DATE)::integer),
  COALESCE(EXTRACT(YEAR FROM v."launchedAt")::integer, EXTRACT(YEAR FROM CURRENT_DATE)::integer)::text,
  v."name" || ' — legacy proceedings',
  'COMPLETED'::"public"."ConferenceEditionStatus",
  v."isPublished",
  (SELECT MIN(m."volume") FROM "public"."Manuscript" m WHERE m."venueId" = v."id" AND m."volume" IS NOT NULL),
  (SELECT MIN(m."isbn") FROM "public"."Manuscript" m WHERE m."venueId" = v."id" AND m."isbn" IS NOT NULL),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."Venue" v
WHERE v."type" = 'CONFERENCE'
  AND NOT EXISTS (SELECT 1 FROM "public"."ConferenceEdition" e WHERE e."venueId" = v."id");

UPDATE "public"."Manuscript" m
SET "editionId" = md5('legacy-conference-edition:' || m."venueId")
FROM "public"."Venue" v
WHERE m."venueId" = v."id"
  AND v."type" = 'CONFERENCE'
  AND m."editionId" IS NULL;

CREATE UNIQUE INDEX "ConferenceEdition_venueId_slug_key" ON "public"."ConferenceEdition"("venueId", "slug");
CREATE UNIQUE INDEX "ConferenceEdition_venueId_year_term_key" ON "public"."ConferenceEdition"("venueId", "year", "term");
CREATE INDEX "ConferenceEdition_venueId_isPublished_startsAt_idx" ON "public"."ConferenceEdition"("venueId", "isPublished", "startsAt" DESC);
CREATE INDEX "ConferenceEdition_venueId_status_idx" ON "public"."ConferenceEdition"("venueId", "status");
CREATE INDEX "Manuscript_editionId_status_createdAt_idx" ON "public"."Manuscript"("editionId", "status", "createdAt" DESC);

ALTER TABLE "public"."ConferenceEdition" ADD CONSTRAINT "ConferenceEdition_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "public"."Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Manuscript" ADD CONSTRAINT "Manuscript_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "public"."ConferenceEdition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
