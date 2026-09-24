-- Store approval-notification contact separately from the institutional requester.
ALTER TABLE "InstitutionDomainRequest" ADD COLUMN "confirmationEmail" TEXT;
UPDATE "InstitutionDomainRequest" SET "confirmationEmail" = "requesterEmail" WHERE "confirmationEmail" IS NULL;
ALTER TABLE "InstitutionDomainRequest" ALTER COLUMN "confirmationEmail" SET NOT NULL;

-- Link publications to ScholarBase journals and scholars.
ALTER TABLE "Publication" ADD COLUMN "journalId" TEXT;
CREATE TABLE "PublicationAuthor" (
  "id" TEXT NOT NULL,
  "publicationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "authorOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicationAuthor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PublicationAuthor_publicationId_userId_key" ON "PublicationAuthor"("publicationId", "userId");
CREATE INDEX "PublicationAuthor_userId_authorOrder_idx" ON "PublicationAuthor"("userId", "authorOrder");
CREATE INDEX "Publication_journalId_idx" ON "Publication"("journalId");
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PublicationAuthor" ADD CONSTRAINT "PublicationAuthor_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationAuthor" ADD CONSTRAINT "PublicationAuthor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
