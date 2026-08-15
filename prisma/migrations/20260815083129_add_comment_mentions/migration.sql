-- AlterTable
ALTER TABLE "ArticleComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "ContributionComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "CourseComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "HelpPostComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "JobVacancyComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "JournalComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "PhdAdmissionComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "PublicationComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "RecommendationComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "ResearchEventComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "ResearchGrantComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "ResearchToolComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "ResultComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "SocialComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "SupervisorComment" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "SurveyComment" ADD COLUMN     "mentions" JSONB;
