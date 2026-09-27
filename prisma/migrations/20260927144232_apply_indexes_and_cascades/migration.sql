-- DropIndex
DROP INDEX "JournalReview_authorId_journalId_active_key";

-- AlterTable
ALTER TABLE "ResearchSurvey" ADD COLUMN     "totalBlocks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalQuestions" INTEGER NOT NULL DEFAULT 0;
