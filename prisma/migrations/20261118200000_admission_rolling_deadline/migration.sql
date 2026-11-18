-- Rolling admissions do not have a fixed closing date.
ALTER TABLE "Admission"
  ALTER COLUMN "deadline" DROP NOT NULL,
  ADD COLUMN "isRolling" BOOLEAN NOT NULL DEFAULT false;
