-- Keep removed survey questions and options available for historical results.
ALTER TABLE "SurveyQuestion" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "SurveyQuestionOption" ADD COLUMN "archivedAt" TIMESTAMP(3);
