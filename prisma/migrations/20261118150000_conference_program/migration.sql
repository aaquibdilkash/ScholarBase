CREATE TYPE "public"."ConferenceProgramItemType" AS ENUM ('KEYNOTE', 'INVITED_TALK', 'PAPER', 'POSTER', 'WORKSHOP', 'BREAK', 'OTHER');

CREATE TABLE "public"."ConferenceProgramItem" (
  "id" TEXT NOT NULL,
  "editionId" TEXT NOT NULL,
  "manuscriptId" TEXT,
  "type" "public"."ConferenceProgramItemType" NOT NULL DEFAULT 'OTHER',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "speakers" TEXT,
  "track" TEXT,
  "room" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "externalUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConferenceProgramItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConferenceProgramItem_editionId_startsAt_sortOrder_idx" ON "public"."ConferenceProgramItem"("editionId", "startsAt", "sortOrder");
CREATE INDEX "ConferenceProgramItem_manuscriptId_idx" ON "public"."ConferenceProgramItem"("manuscriptId");

ALTER TABLE "public"."ConferenceProgramItem" ADD CONSTRAINT "ConferenceProgramItem_editionId_fkey"
  FOREIGN KEY ("editionId") REFERENCES "public"."ConferenceEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ConferenceProgramItem" ADD CONSTRAINT "ConferenceProgramItem_manuscriptId_fkey"
  FOREIGN KEY ("manuscriptId") REFERENCES "public"."Manuscript"("id") ON DELETE SET NULL ON UPDATE CASCADE;
