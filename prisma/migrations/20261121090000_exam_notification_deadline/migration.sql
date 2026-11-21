-- Exam notifications carry a last date to apply, so the publish notification
-- can read "Apply by <date>". Result notifications leave it NULL.
ALTER TABLE "ExamsAndResults"
  ADD COLUMN "deadline" TIMESTAMP(3);
