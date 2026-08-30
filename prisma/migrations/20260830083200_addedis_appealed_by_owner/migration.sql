-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ArticleComment" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Contribution" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ContributionComment" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CourseComment" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "HelpPost" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "HelpPostComment" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "JobVacancy" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "JobVacancyComment" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Journal" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "JournalComment" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PhdAdmission" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PhdAdmissionComment" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Publication" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PublicationComment" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RecommendationComment" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResearchEvent" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResearchEventComment" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResearchGrant" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResearchGrantComment" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResearchSurvey" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResearchTool" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResearchToolComment" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ResultComment" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SocialComment" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SocialPost" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Supervisor" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SupervisorComment" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SurveyComment" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAppealedByOwner" BOOLEAN NOT NULL DEFAULT false;
