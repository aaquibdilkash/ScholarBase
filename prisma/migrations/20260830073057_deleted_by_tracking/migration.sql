-- CreateEnum
CREATE TYPE "DeletedByType" AS ENUM ('AUTHOR', 'PARENT_COMMENT_AUTHOR', 'POST_AUTHOR', 'ADMIN');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "ArticleComment" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "Contribution" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "ContributionComment" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "CourseComment" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "HelpPost" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "HelpPostComment" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "JobVacancy" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "JobVacancyComment" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "Journal" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "JournalComment" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "PhdAdmission" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "PhdAdmissionComment" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "Publication" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "PublicationComment" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "RecommendationComment" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "ResearchEvent" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "ResearchEventComment" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "ResearchGrant" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "ResearchGrantComment" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "ResearchSurvey" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "ResearchTool" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "ResearchToolComment" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "ResultComment" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "SocialComment" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "SocialPost" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "Supervisor" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "SupervisorComment" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";

-- AlterTable
ALTER TABLE "SurveyComment" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByType" "DeletedByType";
