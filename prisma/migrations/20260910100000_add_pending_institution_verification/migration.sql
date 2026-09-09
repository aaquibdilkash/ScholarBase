ALTER TABLE "User"
ADD COLUMN "pendingInstitutionEmail" TEXT,
ADD COLUMN "pendingInstitutionDomain" TEXT;

-- Move old unverified requests out of the verified-address columns so an
-- existing verified address is never overwritten by a replacement request.
UPDATE "User"
SET
  "pendingInstitutionEmail" = "institutionEmail",
  "pendingInstitutionDomain" = "institutionDomain",
  "institutionEmail" = NULL,
  "institutionDomain" = NULL
WHERE "institutionVerifiedAt" IS NULL
  AND "institutionEmail" IS NOT NULL;
