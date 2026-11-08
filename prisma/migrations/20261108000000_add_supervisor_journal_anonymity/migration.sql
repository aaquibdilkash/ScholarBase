-- Anonymous authorship for supervisors and journals, mirroring the existing
-- Recommendation / JournalReview behaviour. When true the author identity is
-- hidden on cards/detail pages and the row is excluded from the author's
-- materialized profile counter and activity log.

ALTER TABLE "public"."Supervisor" ADD COLUMN "isAnonymous" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."Journal" ADD COLUMN "isAnonymous" BOOLEAN NOT NULL DEFAULT false;
