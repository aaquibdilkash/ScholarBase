-- Optional economics classification metadata for manuscript discovery and deposits.
ALTER TABLE "public"."Manuscript"
ADD COLUMN "jelCodes" TEXT;
