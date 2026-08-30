/*
  Warnings:

  - You are about to drop the column `isAppealedByOwner` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `ArticleComment` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `Contribution` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `ContributionComment` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `CourseComment` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `HelpPost` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `HelpPostComment` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `JobVacancy` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `JobVacancyComment` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `Journal` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `JournalComment` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `PhdAdmission` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `PhdAdmissionComment` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `Publication` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `PublicationComment` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `Recommendation` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `RecommendationComment` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `ResearchEvent` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `ResearchEventComment` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `ResearchGrant` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `ResearchGrantComment` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `ResearchSurvey` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `ResearchTool` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `ResearchToolComment` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `Result` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `ResultComment` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `SocialComment` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `SocialPost` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `Supervisor` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `SupervisorComment` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `SurveyComment` table. All the data in the column will be lost.
  - You are about to drop the column `isAppealedByOwner` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Article" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ArticleComment" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Contribution" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ContributionComment" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CourseComment" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "HelpPost" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "HelpPostComment" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "JobVacancy" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "JobVacancyComment" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Journal" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "JournalComment" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PhdAdmission" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PhdAdmissionComment" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Publication" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PublicationComment" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Recommendation" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RecommendationComment" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResearchEvent" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResearchEventComment" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResearchGrant" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResearchGrantComment" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResearchSurvey" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResearchTool" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResearchToolComment" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Result" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResultComment" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SocialComment" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SocialPost" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Supervisor" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SupervisorComment" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SurveyComment" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isAppealedByOwner",
ADD COLUMN     "hasActiveAppeal" BOOLEAN NOT NULL DEFAULT false;
