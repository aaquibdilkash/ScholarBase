ALTER TABLE "AcademicPosition"
  DROP COLUMN "salaryAmount",
  DROP COLUMN "salaryCurrency";

ALTER TABLE "ResearchGrant"
  DROP COLUMN "amountValue",
  DROP COLUMN "amountCurrency",
  DROP COLUMN "amountPeriod";
