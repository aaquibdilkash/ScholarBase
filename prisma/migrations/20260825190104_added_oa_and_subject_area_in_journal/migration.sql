-- CreateEnum
CREATE TYPE "OpenAccessStatus" AS ENUM ('CLOSED', 'HYBRID', 'GOLD', 'DIAMOND', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DigestPreference" AS ENUM ('DAILY', 'WEEKLY', 'NEVER');

-- AlterTable
ALTER TABLE "Journal" ADD COLUMN     "frequency" TEXT,
ADD COLUMN     "openAccess" "OpenAccessStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "subjectArea" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "isEmailed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "digestPreference" "DigestPreference" NOT NULL DEFAULT 'DAILY';

-- CreateIndex
CREATE INDEX "Notification_recipientId_isEmailed_idx" ON "Notification"("recipientId", "isEmailed");
