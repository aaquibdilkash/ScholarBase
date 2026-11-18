ALTER TABLE "AcademicPosition"
  ADD COLUMN "salaryAmount" DOUBLE PRECISION,
  ADD COLUMN "salaryCurrency" TEXT,
  ADD COLUMN "durationValue" DOUBLE PRECISION,
  ADD COLUMN "durationUnit" TEXT;

ALTER TABLE "ResearchGrant"
  ADD COLUMN "amountValue" DOUBLE PRECISION,
  ADD COLUMN "amountCurrency" TEXT,
  ADD COLUMN "amountPeriod" TEXT;
