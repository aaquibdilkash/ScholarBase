/*
  Warnings:

  - Added the required column `updatedAt` to the `ConversationParticipant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `JobVacancy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PhdAdmission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Recommendation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ResearchEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Supervisor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `SurveyQuestionOption` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Contribution" ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "HelpPost" ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "JobVacancy" ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Journal" ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "PhdAdmission" ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Publication" ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ResearchEvent" ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ResearchSurvey" ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResearchTool" ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SocialPost" ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Supervisor" ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "SurveyQuestionOption" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isFrozen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
