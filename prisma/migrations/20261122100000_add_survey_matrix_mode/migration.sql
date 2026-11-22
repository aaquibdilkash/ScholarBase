CREATE TYPE "SurveyMatrixMode" AS ENUM ('SINGLE', 'MULTIPLE');

ALTER TABLE "SurveyQuestion"
ADD COLUMN "matrixMode" "SurveyMatrixMode" NOT NULL DEFAULT 'SINGLE';
