ALTER TABLE "public"."CallForPaper"
  ADD COLUMN "publisher" TEXT,
  ADD COLUMN "journalId" TEXT;

CREATE INDEX "CallForPaper_journalId_idx"
  ON "public"."CallForPaper"("journalId");

ALTER TABLE "public"."CallForPaper"
  ADD CONSTRAINT "CallForPaper_journalId_fkey"
  FOREIGN KEY ("journalId") REFERENCES "public"."Journal"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
