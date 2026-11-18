CREATE TYPE "public"."PublicationNoticeType" AS ENUM (
  'CORRECTION', 'RETRACTION', 'EXPRESSION_OF_CONCERN'
);

CREATE TABLE "public"."PublicationNotice" (
  "id" TEXT NOT NULL,
  "manuscriptId" TEXT NOT NULL,
  "type" "public"."PublicationNoticeType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "PublicationNotice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublicationNotice_manuscriptId_effectiveAt_idx"
  ON "public"."PublicationNotice"("manuscriptId", "effectiveAt" DESC);
CREATE INDEX "PublicationNotice_type_effectiveAt_idx"
  ON "public"."PublicationNotice"("type", "effectiveAt" DESC);

ALTER TABLE "public"."PublicationNotice"
  ADD CONSTRAINT "PublicationNotice_manuscriptId_fkey"
  FOREIGN KEY ("manuscriptId") REFERENCES "public"."Manuscript"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."PublicationNotice"
  ADD CONSTRAINT "PublicationNotice_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "public"."User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
