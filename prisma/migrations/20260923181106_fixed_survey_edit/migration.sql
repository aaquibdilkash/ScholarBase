/*
  Warnings:

  - A unique constraint covering the columns `[surveyId,clientKey]` on the table `SurveyBlock` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[surveyId,clientKey]` on the table `SurveyQuestion` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SurveyBlock" ADD COLUMN     "clientKey" TEXT;

-- AlterTable
ALTER TABLE "SurveyQuestion" ADD COLUMN     "clientKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SurveyBlock_surveyId_clientKey_key" ON "SurveyBlock"("surveyId", "clientKey");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyQuestion_surveyId_clientKey_key" ON "SurveyQuestion"("surveyId", "clientKey");
