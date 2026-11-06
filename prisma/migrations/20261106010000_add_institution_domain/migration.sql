-- Approved institutional domains (no redeploy required to add a new one).
--
-- When an admin approves an InstitutionDomainRequest, the domain is inserted
-- here. `isAllowedEmailDomain` / `isInstitutionalEmailDomain` check this table
-- (with a module-level cache) alongside the static JSON directory, so newly
-- approved domains become available for signup immediately.
--
-- `isActive` lets admins disable a domain without deleting its history.

CREATE TABLE "public"."InstitutionDomain" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionDomain_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InstitutionDomain_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InstitutionDomain_domain_key" ON "public"."InstitutionDomain"("domain");
CREATE INDEX "InstitutionDomain_isActive_createdAt_idx" ON "public"."InstitutionDomain"("isActive", "createdAt" DESC);
