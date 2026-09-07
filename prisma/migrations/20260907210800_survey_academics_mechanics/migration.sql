-- AlterEnum
ALTER TYPE "SurveyQuestionType" ADD VALUE 'MATRIX_LIKERT';

-- AlterTable
ALTER TABLE "ResearchSurvey" ADD COLUMN     "consentRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentText" TEXT;

-- AlterTable
ALTER TABLE "SurveyQuestion" ADD COLUMN     "blockId" TEXT,
ADD COLUMN     "columnLabels" JSONB,
ADD COLUMN     "shuffleOptions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skipLogic" JSONB;

-- AlterTable
ALTER TABLE "SurveyResponse" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "consentedAt" TIMESTAMP(3),
ADD COLUMN     "randomizationSeed" INTEGER,
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "SurveyBlock" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "randomizeOrder" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SurveyBlock_surveyId_order_idx" ON "SurveyBlock"("surveyId", "order" ASC);

-- AddForeignKey
ALTER TABLE "SurveyBlock" ADD CONSTRAINT "SurveyBlock_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "ResearchSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "SurveyBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
