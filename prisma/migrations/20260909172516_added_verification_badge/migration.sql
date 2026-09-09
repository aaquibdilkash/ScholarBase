/*
  Warnings:

  - A unique constraint covering the columns `[institutionEmail]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[institutionVerificationTokenHash]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "InstitutionDomainRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "institutionDomain" TEXT,
ADD COLUMN     "institutionEmail" TEXT,
ADD COLUMN     "institutionVerificationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "institutionVerificationTokenHash" TEXT,
ADD COLUMN     "institutionVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "InstitutionDomainRequest" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "website" TEXT,
    "details" TEXT,
    "status" "InstitutionDomainRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionDomainRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionDomainRequest_domain_key" ON "InstitutionDomainRequest"("domain");

-- CreateIndex
CREATE INDEX "InstitutionDomainRequest_status_createdAt_idx" ON "InstitutionDomainRequest"("status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "User_institutionEmail_key" ON "User"("institutionEmail");

-- CreateIndex
CREATE UNIQUE INDEX "User_institutionVerificationTokenHash_key" ON "User"("institutionVerificationTokenHash");

-- AddForeignKey
ALTER TABLE "InstitutionDomainRequest" ADD CONSTRAINT "InstitutionDomainRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
